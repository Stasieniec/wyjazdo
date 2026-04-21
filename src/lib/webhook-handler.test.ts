import { describe, it, expect, vi } from "vitest";
import { handleStripeEvent, type WebhookDeps } from "./webhook-handler";
import type Stripe from "stripe";

const deps = (options?: { alreadyProcessed?: Set<string> }) => {
  const seen = options?.alreadyProcessed ?? new Set<string>();
  const calls = {
    succeed: vi.fn(async () => true),
    expire: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
    refund: vi.fn(async () => {}),
    onboardingUpdate: vi.fn(async () => {}),
    recordProcessed: vi.fn(async ({ eventId }: { eventId: string; eventType: string }) => {
      if (seen.has(eventId)) return false;
      seen.add(eventId);
      return true;
    }),
    unrecordProcessed: vi.fn(async (eventId: string) => {
      seen.delete(eventId);
    }),
    now: vi.fn(() => 42),
  };
  const d: WebhookDeps = {
    markPaymentSucceeded: calls.succeed,
    markPaymentExpired: calls.expire,
    markPaymentFailed: calls.fail,
    markPaymentRefunded: calls.refund,
    syncOrganizerFromAccount: calls.onboardingUpdate,
    recordProcessedEvent: calls.recordProcessed,
    unrecordProcessedEvent: calls.unrecordProcessed,
    now: calls.now,
  };
  return { d, calls };
};

let nextEvtId = 1;
const evt = <T extends Stripe.Event["type"]>(type: T, data: object, account?: string): Stripe.Event =>
  ({
    id: `evt_${nextEvtId++}`,
    type,
    account,
    data: { object: data as never },
  }) as unknown as Stripe.Event;

describe("handleStripeEvent", () => {
  it("updates payment on checkout.session.completed", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.completed", {
        metadata: { payment_id: "pay_1" },
        payment_intent: "pi_1",
        amount_total: 1234,
      }),
      d,
    );
    expect(calls.succeed).toHaveBeenCalledWith({
      paymentId: "pay_1",
      stripePaymentIntentId: "pi_1",
      amountCents: 1234,
      applicationFeeCents: null,
      paidAt: 42,
    });
  });

  it("expires payment on session.expired", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.expired", { metadata: { payment_id: "pay_1" } }),
      d,
    );
    expect(calls.expire).toHaveBeenCalledWith("pay_1");
  });

  it("fails payment on payment_intent.payment_failed", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("payment_intent.payment_failed", { metadata: { payment_id: "pay_1" } }),
      d,
    );
    expect(calls.fail).toHaveBeenCalledWith("pay_1");
  });

  it("refunds by payment_intent on charge.refunded", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("charge.refunded", { payment_intent: "pi_9" }),
      d,
    );
    expect(calls.refund).toHaveBeenCalledWith("pi_9");
  });

  it("syncs organizer on account.updated", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("account.updated", {
        id: "acct_1",
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
      }),
      d,
    );
    expect(calls.onboardingUpdate).toHaveBeenCalledWith({
      accountId: "acct_1",
      onboardingComplete: true,
      payoutsEnabled: true,
    });
  });

  it("ignores events without payment_id metadata", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.completed", { metadata: {}, payment_intent: "pi_1", amount_total: 10 }),
      d,
    );
    expect(calls.succeed).not.toHaveBeenCalled();
  });

  it("short-circuits on replayed event.id", async () => {
    const { d, calls } = deps();
    const event = evt("charge.refunded", { payment_intent: "pi_9" });
    await handleStripeEvent(event, d);
    await handleStripeEvent(event, d);
    expect(calls.refund).toHaveBeenCalledTimes(1);
    expect(calls.recordProcessed).toHaveBeenCalledTimes(2);
  });

  it("undoes the idempotency record and rethrows when processing fails", async () => {
    const { d, calls } = deps();
    calls.refund.mockRejectedValueOnce(new Error("db blip"));
    const event = evt("charge.refunded", { payment_intent: "pi_42" });
    await expect(handleStripeEvent(event, d)).rejects.toThrow("db blip");
    expect(calls.unrecordProcessed).toHaveBeenCalledWith(event.id);

    // Stripe's retry should then proceed — the second attempt is treated as fresh.
    calls.refund.mockResolvedValueOnce(undefined);
    await handleStripeEvent(event, d);
    expect(calls.refund).toHaveBeenCalledTimes(2);
  });
});

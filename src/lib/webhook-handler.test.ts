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
    isProcessed: vi.fn(async (eventId: string) => seen.has(eventId)),
    recordProcessed: vi.fn(async ({ eventId }: { eventId: string; eventType: string }) => {
      seen.add(eventId);
    }),
    now: vi.fn(() => 42),
  };
  const d: WebhookDeps = {
    markPaymentSucceeded: calls.succeed,
    markPaymentExpired: calls.expire,
    markPaymentFailed: calls.fail,
    recordRefund: calls.refund,
    syncOrganizerFromAccount: calls.onboardingUpdate,
    isEventProcessed: calls.isProcessed,
    recordProcessedEvent: calls.recordProcessed,
    now: calls.now,
  };
  return { d, calls, seen };
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
  it("records a paid checkout.session.completed", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.completed", {
        id: "cs_1",
        metadata: { payment_id: "pay_1" },
        payment_intent: "pi_1",
        amount_total: 1234,
        payment_status: "paid",
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

  it("does not record success when the completed session is still unpaid (delayed method)", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.completed", {
        id: "cs_1",
        metadata: { payment_id: "pay_1" },
        payment_intent: "pi_1",
        amount_total: 1234,
        payment_status: "unpaid",
      }),
      d,
    );
    expect(calls.succeed).not.toHaveBeenCalled();
  });

  it("records success on checkout.session.async_payment_succeeded", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.async_payment_succeeded", {
        id: "cs_1",
        metadata: { payment_id: "pay_1" },
        payment_intent: "pi_1",
        amount_total: 50000,
        payment_status: "paid",
      }),
      d,
    );
    expect(calls.succeed).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "pay_1", amountCents: 50000 }),
    );
  });

  it("fails the payment for that session on checkout.session.async_payment_failed", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.async_payment_failed", { id: "cs_7", metadata: { payment_id: "pay_1" } }),
      d,
    );
    expect(calls.fail).toHaveBeenCalledWith("pay_1", "cs_7");
  });

  it("expires the payment for that session on session.expired", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.expired", { id: "cs_3", metadata: { payment_id: "pay_1" } }),
      d,
    );
    expect(calls.expire).toHaveBeenCalledWith("pay_1", "cs_3");
  });

  it("leaves the payment pending on payment_intent.payment_failed (guest can retry in the same checkout)", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("payment_intent.payment_failed", { metadata: { payment_id: "pay_1" } }),
      d,
    );
    expect(calls.fail).not.toHaveBeenCalled();
    expect(calls.expire).not.toHaveBeenCalled();
  });

  it("declined card then successful retry ends as succeeded", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(evt("payment_intent.payment_failed", { metadata: { payment_id: "pay_1" } }), d);
    await handleStripeEvent(
      evt("checkout.session.completed", {
        id: "cs_1",
        metadata: { payment_id: "pay_1" },
        payment_intent: "pi_1",
        amount_total: 50000,
        payment_status: "paid",
      }),
      d,
    );
    expect(calls.fail).not.toHaveBeenCalled();
    expect(calls.succeed).toHaveBeenCalledTimes(1);
  });

  it("records a partial refund without marking the payment fully refunded", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("charge.refunded", { payment_intent: "pi_9", amount: 148000, amount_refunded: 50000, refunded: false }),
      d,
    );
    expect(calls.refund).toHaveBeenCalledWith({
      paymentIntentId: "pi_9",
      amountRefundedCents: 50000,
      fullyRefunded: false,
    });
  });

  it("records a full refund", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("charge.refunded", { payment_intent: "pi_9", amount: 50000, amount_refunded: 50000, refunded: true }),
      d,
    );
    expect(calls.refund).toHaveBeenCalledWith({
      paymentIntentId: "pi_9",
      amountRefundedCents: 50000,
      fullyRefunded: true,
    });
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
      evt("checkout.session.completed", {
        metadata: {},
        payment_intent: "pi_1",
        amount_total: 10,
        payment_status: "paid",
      }),
      d,
    );
    expect(calls.succeed).not.toHaveBeenCalled();
  });

  it("short-circuits on replayed event.id", async () => {
    const { d, calls } = deps();
    const event = evt("charge.refunded", { payment_intent: "pi_9", amount: 100, amount_refunded: 100, refunded: true });
    await handleStripeEvent(event, d);
    await handleStripeEvent(event, d);
    expect(calls.refund).toHaveBeenCalledTimes(1);
    expect(calls.recordProcessed).toHaveBeenCalledTimes(1);
  });

  it("records the event only after the handler succeeded, so a retry redoes the work", async () => {
    const { d, calls, seen } = deps();
    calls.succeed.mockRejectedValueOnce(new Error("db blip"));
    const event = evt("checkout.session.completed", {
      id: "cs_1",
      metadata: { payment_id: "pay_1" },
      payment_intent: "pi_1",
      amount_total: 50000,
      payment_status: "paid",
    });
    await expect(handleStripeEvent(event, d)).rejects.toThrow("db blip");
    expect(calls.recordProcessed).not.toHaveBeenCalled();
    expect(seen.has(event.id)).toBe(false);

    await handleStripeEvent(event, d);
    expect(calls.succeed).toHaveBeenCalledTimes(2);
    expect(seen.has(event.id)).toBe(true);
  });
});

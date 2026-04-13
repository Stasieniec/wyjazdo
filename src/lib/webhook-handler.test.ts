import { describe, it, expect, vi } from "vitest";
import { handleStripeEvent, type WebhookDeps } from "./webhook-handler";

function makeDeps(overrides: Partial<WebhookDeps> = {}): WebhookDeps {
  return {
    markPaid: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

describe("handleStripeEvent", () => {
  it("marks paid on checkout.session.completed with metadata.participant_id", async () => {
    const deps = makeDeps();
    await handleStripeEvent(
      {
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { participant_id: "P1" },
            payment_intent: "pi_1",
            amount_total: 12345,
          },
        },
      } as any,
      deps,
    );
    expect(deps.markPaid).toHaveBeenCalledWith({
      participantId: "P1",
      paymentIntentId: "pi_1",
      amountCents: 12345,
      paidAt: 1_700_000_000_000,
    });
    expect(deps.cancel).not.toHaveBeenCalled();
  });

  it("cancels on checkout.session.expired", async () => {
    const deps = makeDeps();
    await handleStripeEvent(
      {
        type: "checkout.session.expired",
        data: { object: { metadata: { participant_id: "P2" } } },
      } as any,
      deps,
    );
    expect(deps.cancel).toHaveBeenCalledWith("P2");
  });

  it("cancels on payment_intent.payment_failed via session lookup metadata", async () => {
    const deps = makeDeps();
    await handleStripeEvent(
      {
        type: "payment_intent.payment_failed",
        data: { object: { metadata: { participant_id: "P3" } } },
      } as any,
      deps,
    );
    expect(deps.cancel).toHaveBeenCalledWith("P3");
  });

  it("ignores unknown event types", async () => {
    const deps = makeDeps();
    await handleStripeEvent(
      { type: "customer.created", data: { object: {} } } as any,
      deps,
    );
    expect(deps.markPaid).not.toHaveBeenCalled();
    expect(deps.cancel).not.toHaveBeenCalled();
  });

  it("no-op when participant_id is missing", async () => {
    const deps = makeDeps();
    await handleStripeEvent(
      {
        type: "checkout.session.completed",
        data: { object: { metadata: {}, payment_intent: "pi", amount_total: 100 } },
      } as any,
      deps,
    );
    expect(deps.markPaid).not.toHaveBeenCalled();
  });
});

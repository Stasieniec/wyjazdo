import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => import("@/test/db-mock").then((m) => m.dbClientMock()));
const email = vi.hoisted(() => ({
  sendOrganizerNewRegistration: vi.fn(async () => {}),
  sendPaymentConfirmation: vi.fn(async () => {}),
  sendOrganizerAttention: vi.fn(async () => {}),
}));
vi.mock("@/lib/email/send", () => email);
vi.mock("@/lib/participant-auth", () => ({
  getParticipantAuthSecret: () => "secret",
  signParticipantToken: async () => "tok",
}));
const checkout = vi.hoisted(() => ({
  closeCheckoutSession: vi.fn(async (): Promise<"closed" | "complete"> => "closed"),
}));
vi.mock("@/lib/stripe-checkout", () => checkout);

import { resetTestDb, rows, testDb } from "@/test/db-mock";
import { seedEvent, seedOrganizer, seedRegistration } from "@/test/fixtures";
import { cancelRegistration, recordPaymentSuccess } from "./payment-outcomes";
import { countTakenSpots } from "@/lib/capacity";
import { recordPaymentRefund } from "@/lib/db/queries/payments";
import { getFinanceSummary } from "@/lib/db/queries/finance";

beforeEach(() => {
  resetTestDb();
  vi.clearAllMocks();
});

async function setup(capacity = 16) {
  const { db } = testDb();
  const org = await seedOrganizer(db);
  const ev = await seedEvent(db, org.id, { capacity });
  return { db, org, ev };
}

const success = (paymentId: string, pi = "pi_1", amountCents = 100_000) =>
  recordPaymentSuccess({ paymentId, providerPaymentId: pi, amountCents, paidAt: Date.now() });

describe("recordPaymentSuccess", () => {
  it.each(["pending", "failed", "expired"] as const)(
    "a success wins over a %s row and sends the confirmation once",
    async (status) => {
      const { db, ev } = await setup();
      const r = await seedRegistration(db, ev.id, { seats: 2, payments: [{ status }] });
      expect(await success(r.payments[0].id!)).toBe(true);
      expect(await success(r.payments[0].id!)).toBe(false); // webhook retry
      expect(rows("SELECT status, stripe_payment_intent_id AS pi FROM payments")).toEqual([
        { status: "succeeded", pi: "pi_1" },
      ]);
      expect(email.sendPaymentConfirmation).toHaveBeenCalledTimes(1);
      expect(email.sendPaymentConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: "kontakt@example.com" }),
      );
      expect(await countTakenSpots(ev.id, Date.now())).toBe(2);
    },
  );

  it("leaves a refunded row alone", async () => {
    const { db, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      payments: [{ status: "refunded", stripePaymentIntentId: "pi_1" }],
    });
    expect(await success(r.payments[0].id!)).toBe(false);
    expect(rows("SELECT status FROM payments")).toEqual([{ status: "refunded" }]);
  });

  it("a lapsed hold that gets paid after its place was taken is recorded and flagged as overbooked", async () => {
    const { db, ev } = await setup(2);
    const late = await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "expired" }] });
    await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "succeeded" }] });

    expect(await success(late.payments[0].id!)).toBe(true);
    expect(rows("SELECT status FROM payments WHERE id = ?", late.payments[0].id)).toEqual([
      { status: "succeeded" },
    ]);
    expect(rows("SELECT attention_reason FROM participants WHERE id = ?", late.participant.id)).toEqual([
      { attention_reason: "overbooked" },
    ]);
    expect(email.sendOrganizerAttention).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "overbooked" }),
    );
    // The guest still gets their confirmation: they paid.
    expect(email.sendPaymentConfirmation).toHaveBeenCalledTimes(1);
  });

  it("a lapsed hold paid while there is still room just takes its place back", async () => {
    const { db, ev } = await setup(4);
    const late = await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "expired" }] });
    await success(late.payments[0].id!);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(2);
    expect(rows("SELECT attention_reason FROM participants")).toEqual([{ attention_reason: null }]);
  });

  it("a cancelled participant who pays stays cancelled and is flagged", async () => {
    const { db, ev } = await setup();
    const r = await seedRegistration(db, ev.id, { lifecycle: "cancelled", payments: [{ status: "expired" }] });
    await success(r.payments[0].id!);
    expect(rows("SELECT lifecycle_status, attention_reason FROM participants")).toEqual([
      { lifecycle_status: "cancelled", attention_reason: "paid_while_cancelled" },
    ]);
    expect(rows("SELECT status FROM payments")).toEqual([{ status: "succeeded" }]);
    expect(email.sendPaymentConfirmation).not.toHaveBeenCalled();
  });

  it("a second charge on an already paid row is flagged, not lost silently", async () => {
    const { db, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      payments: [{ status: "succeeded", stripePaymentIntentId: "pi_first" }],
    });
    expect(await success(r.payments[0].id!, "pi_second")).toBe(false);
    expect(rows("SELECT attention_reason FROM participants")).toEqual([
      { attention_reason: "duplicate_payment" },
    ]);
  });
});

describe("cancelRegistration", () => {
  it("closes the open checkout, releases the place, and a late payment is flagged", async () => {
    const { db, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      seats: 2,
      payments: [{ status: "pending", stripeSessionId: "cs_open" }],
    });
    await cancelRegistration({ participantId: r.participant.id, stripeAccountId: "acct_test" });
    expect(checkout.closeCheckoutSession).toHaveBeenCalledWith("acct_test", "cs_open");
    expect(rows("SELECT status FROM payments")).toEqual([{ status: "expired" }]);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(0);

    await success(r.payments[0].id!);
    expect(rows("SELECT lifecycle_status, attention_reason FROM participants")).toEqual([
      { lifecycle_status: "cancelled", attention_reason: "paid_while_cancelled" },
    ]);
  });
});

describe("refunds", () => {
  it("a partial refund keeps the payment succeeded and the finance page counts only what was kept", async () => {
    const { db, org, ev } = await setup();
    await seedRegistration(db, ev.id, {
      seats: 2,
      payments: [{ status: "succeeded", amountCents: 100_000, stripePaymentIntentId: "pi_dep" }],
    });
    await recordPaymentRefund({ paymentIntentId: "pi_dep", amountRefundedCents: 50_000, fullyRefunded: false });
    expect(rows("SELECT status, refunded_amount_cents AS r FROM payments")).toEqual([
      { status: "succeeded", r: 50_000 },
    ]);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(2);

    const summary = await getFinanceSummary(org.id);
    expect(summary.totalRevenueCents).toBe(50_000);
    expect(summary.refundedCents).toBe(50_000);

    await recordPaymentRefund({ paymentIntentId: "pi_dep", amountRefundedCents: 100_000, fullyRefunded: true });
    expect(rows("SELECT status, refunded_amount_cents AS r FROM payments")).toEqual([
      { status: "refunded", r: 100_000 },
    ]);
    const after = await getFinanceSummary(org.id);
    expect(after.totalRevenueCents).toBe(0);
    expect(after.refundedCents).toBe(100_000);
  });
});

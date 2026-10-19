import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => import("@/test/db-mock").then((m) => m.dbClientMock()));
vi.mock("@/lib/participant-auth", () => ({
  getParticipantAuthSecret: () => "secret",
  signParticipantToken: async () => "tok",
}));
type State =
  | { state: "open"; url: string; amountCents: number | null }
  | { state: "complete" }
  | { state: "gone" };
const checkout = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(async (p: { paymentId: string }) => ({
    id: `cs_new_${p.paymentId}`,
    url: `https://checkout.stripe.test/new/${p.paymentId}`,
  })),
  getCheckoutSessionState: vi.fn(async (): Promise<State> => ({ state: "gone" })),
  closeCheckoutSession: vi.fn(async (): Promise<"closed" | "complete"> => "closed"),
}));
vi.mock("@/lib/stripe-checkout", () => checkout);

import { resetTestDb, rows, testDb } from "@/test/db-mock";
import { seedEvent, seedOrganizer, seedRegistration, DAY } from "@/test/fixtures";
import { openFirstPaymentCheckout, CheckoutBlockedError } from "./first-payment";
import { ensureBalancePayment } from "./ensure-balance-payment";
import { countTakenSpots } from "@/lib/capacity";
import { getParticipantById } from "@/lib/db/queries/participants";
import type { Event, Organizer, Participant } from "@/lib/db/schema";

beforeEach(() => {
  resetTestDb();
  vi.clearAllMocks();
});

async function setup(eventOver: Parameters<typeof seedEvent>[2] = {}) {
  const { db } = testDb();
  const org = (await seedOrganizer(db)) as Organizer;
  const ev = (await seedEvent(db, org.id, eventOver)) as Event;
  return { db, org, ev };
}

const fullParticipant = async (p: { id?: string }) => (await getParticipantById(p.id!)) as Participant;

const open = (participant: Participant, event: Event, organizer: Organizer, reuseOpen: boolean) =>
  openFirstPaymentCheckout({
    participant,
    event,
    organizer,
    successUrl: "https://x/thanks",
    cancelUrl: "https://x",
    reuseOpen,
  });

describe("openFirstPaymentCheckout (resend link / my-trips pay button)", () => {
  it("expires the old open session before creating a new one", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      seats: 2,
      payments: [{ status: "pending", stripeSessionId: "cs_old" }],
    });
    checkout.getCheckoutSessionState.mockResolvedValueOnce({ state: "open", url: "https://old", amountCents: 100_000 });
    const url = await open(await fullParticipant(r.participant), ev, org, false);
    expect(checkout.closeCheckoutSession).toHaveBeenCalledWith("acct_test", "cs_old");
    expect(url).toContain("/new/");
    const closeOrder = checkout.closeCheckoutSession.mock.invocationCallOrder[0];
    const createOrder = checkout.createCheckoutSession.mock.invocationCallOrder[0];
    expect(closeOrder).toBeLessThan(createOrder);
    expect(rows("SELECT stripe_session_id AS s, status FROM payments")).toEqual([
      { s: `cs_new_${r.payments[0].id}`, status: "pending" },
    ]);
  });

  it("returns the still-open session for a participant who clicks pay again", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, { payments: [{ status: "pending", stripeSessionId: "cs_old" }] });
    checkout.getCheckoutSessionState.mockResolvedValueOnce({ state: "open", url: "https://old", amountCents: 50_000 });
    expect(await open(await fullParticipant(r.participant), ev, org, true)).toBe("https://old");
    expect(checkout.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses to create a session when the old one was already paid (webhook in flight)", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, { payments: [{ status: "pending", stripeSessionId: "cs_old" }] });
    checkout.getCheckoutSessionState.mockResolvedValueOnce({ state: "complete" });
    await expect(open(await fullParticipant(r.participant), ev, org, false)).rejects.toMatchObject({
      reason: "payment_in_progress",
    });
    expect(checkout.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses when the old session completes between the check and the expire call", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, { payments: [{ status: "pending", stripeSessionId: "cs_old" }] });
    checkout.getCheckoutSessionState.mockResolvedValueOnce({ state: "open", url: "https://old", amountCents: 50_000 });
    checkout.closeCheckoutSession.mockResolvedValueOnce("complete");
    await expect(open(await fullParticipant(r.participant), ev, org, false)).rejects.toBeInstanceOf(CheckoutBlockedError);
    expect(checkout.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("re-opens a lapsed checkout only if the party still fits", async () => {
    const { db, org, ev } = await setup({ capacity: 3 });
    const lapsed = await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "expired" }] });
    await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "succeeded" }] });
    await expect(open(await fullParticipant(lapsed.participant), ev, org, true)).rejects.toMatchObject({
      reason: "no_place",
    });
    expect(rows("SELECT status FROM payments WHERE id = ?", lapsed.payments[0].id)).toEqual([{ status: "expired" }]);

    // Someone cancels: now it fits.
    cancelPaidRegistrations();
    const url = await open(await fullParticipant(lapsed.participant), ev, org, true);
    expect(url).toContain("/new/");
    expect(await countTakenSpots(ev.id, Date.now())).toBe(2);
  });

  it("refuses for a cancelled participant", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, { lifecycle: "cancelled", payments: [{ status: "expired" }] });
    await expect(open(await fullParticipant(r.participant), ev, org, true)).rejects.toMatchObject({
      reason: "not_active",
    });
  });
});

function cancelPaidRegistrations() {
  testDb().d1.sqlite.prepare(
    "UPDATE participants SET lifecycle_status = 'cancelled' WHERE id IN (SELECT participant_id FROM payments WHERE status = 'succeeded')",
  ).run();
}

describe("ensureBalancePayment", () => {
  const balanceFor = async (participant: Participant, event: Event, organizer: Organizer) =>
    ensureBalancePayment({ participant, event, organizer, origin: "https://wyjazdo.test" });

  it("charges total minus what was actually paid, ignoring later deposit and price edits", async () => {
    // Pair registered at 1480 each, paid 2 x 500 deposit. Organizer later
    // changes the deposit to 600 and the price to 1580.
    const { db, org, ev } = await setup({ depositCents: 60_000, priceCents: 158_000 });
    const r = await seedRegistration(db, ev.id, {
      seats: 2,
      payments: [{ kind: "deposit", status: "succeeded", amountCents: 100_000 }],
    });
    await balanceFor(await fullParticipant(r.participant), ev, org);
    expect(checkout.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 296_000 - 100_000 }),
    );
  });

  it("accounts for a removed attendee and a partial refund", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      seats: 2,
      payments: [{ kind: "deposit", status: "succeeded", amountCents: 100_000, refundedAmountCents: 50_000 }],
    });
    testDb().d1.sqlite.prepare("UPDATE attendees SET cancelled_at = 1 WHERE id = ?").run(r.attendees[1].id);
    await balanceFor(await fullParticipant(r.participant), ev, org);
    expect(checkout.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 148_000 - 50_000 }),
    );
  });

  it("reuses an expired balance row instead of inserting another", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      payments: [
        { kind: "deposit", status: "succeeded", amountCents: 50_000 },
        { kind: "balance", status: "expired", amountCents: 98_000, stripeSessionId: "cs_dead", dueAt: Date.now() - DAY },
      ],
    });
    await balanceFor(await fullParticipant(r.participant), ev, org);
    expect(rows("SELECT status FROM payments WHERE kind = 'balance'")).toEqual([{ status: "pending" }]);
  });

  it("returns the open balance session when nothing changed", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      payments: [
        { kind: "deposit", status: "succeeded", amountCents: 50_000 },
        { kind: "balance", status: "pending", amountCents: 98_000, stripeSessionId: "cs_bal" },
      ],
    });
    checkout.getCheckoutSessionState.mockResolvedValueOnce({ state: "open", url: "https://bal", amountCents: 98_000 });
    expect(await balanceFor(await fullParticipant(r.participant), ev, org)).toBe("https://bal");
    expect(checkout.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("does not create a second session when the pending one is already complete", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      payments: [
        { kind: "deposit", status: "succeeded", amountCents: 50_000 },
        { kind: "balance", status: "pending", amountCents: 98_000, stripeSessionId: "cs_bal" },
      ],
    });
    checkout.getCheckoutSessionState.mockResolvedValueOnce({ state: "complete" });
    await expect(balanceFor(await fullParticipant(r.participant), ev, org)).rejects.toMatchObject({
      reason: "payment_in_progress",
    });
    expect(checkout.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses a cancelled participant", async () => {
    const { db, org, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      lifecycle: "cancelled",
      payments: [{ kind: "deposit", status: "succeeded", amountCents: 50_000 }],
    });
    await expect(balanceFor(await fullParticipant(r.participant), ev, org)).rejects.toMatchObject({
      reason: "not_active",
    });
  });
});

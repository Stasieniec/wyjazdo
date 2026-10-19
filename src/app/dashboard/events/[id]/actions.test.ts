import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => import("@/test/db-mock").then((m) => m.dbClientMock()));
const clerk = vi.hoisted(() => ({ userId: "" }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: clerk.userId }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const afterCallbacks = vi.hoisted(() => [] as (() => Promise<unknown>)[]);
vi.mock("next/server", () => ({ after: (cb: () => Promise<unknown>) => afterCallbacks.push(cb) }));
vi.mock("@/lib/participant-auth", () => ({
  getParticipantAuthSecret: () => "secret",
  signParticipantToken: async () => "tok",
}));
const email = vi.hoisted(() => ({
  sendWaitlistPromoted: vi.fn(async () => {}),
  sendResendPaymentLink: vi.fn(async () => {}),
  sendPaymentConfirmation: vi.fn(async () => {}),
  sendOrganizerNewRegistration: vi.fn(async () => {}),
}));
vi.mock("@/lib/email/send", () => email);
const checkout = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(async (p: { paymentId: string }) => ({
    id: `cs_${p.paymentId}`,
    url: `https://checkout.stripe.test/${p.paymentId}`,
  })),
  getCheckoutSessionState: vi.fn(async () => ({ state: "gone" as const })),
  closeCheckoutSession: vi.fn(async (): Promise<"closed" | "complete"> => "closed"),
}));
vi.mock("@/lib/stripe-checkout", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe-checkout")>()),
  ...checkout,
}));

import { resetTestDb, rows, testDb } from "@/test/db-mock";
import { seedEvent, seedOrganizer, seedRegistration } from "@/test/fixtures";
import {
  promoteFromWaitlistAction,
  resendPaymentLinkAction,
  cancelParticipantAction,
  extendBalanceDeadlineAction,
} from "./actions";
import { countTakenSpots } from "@/lib/capacity";

beforeEach(() => {
  resetTestDb();
  afterCallbacks.length = 0;
  vi.clearAllMocks();
});

async function setup(capacity = 16) {
  const { db } = testDb();
  const org = await seedOrganizer(db);
  clerk.userId = org.clerkUserId;
  const ev = await seedEvent(db, org.id, { capacity });
  return { db, org, ev };
}

function fd(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

/** datetime-local value N minutes from now, in Warsaw wall time. */
function warsawInputIn(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return parts.replace(" ", "T");
}

describe("promoteFromWaitlistAction", () => {
  it("refuses a waitlisted pair when only one seat is free", async () => {
    const { db, ev } = await setup(3);
    await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "succeeded" }] });
    const w = await seedRegistration(db, ev.id, { seats: 2, lifecycle: "waitlisted" });
    await expect(
      promoteFromWaitlistAction(fd({ participantId: w.participant.id, expiresAt: warsawInputIn(120) })),
    ).rejects.toThrow("no capacity");
    expect(rows("SELECT lifecycle_status FROM participants WHERE id = ?", w.participant.id)).toEqual([
      { lifecycle_status: "waitlisted" },
    ]);
    expect(rows("SELECT id FROM payments WHERE participant_id = ?", w.participant.id)).toEqual([]);
  });

  it("promotes a pair that fits, with the deposit for both and a held place", async () => {
    const { db, ev } = await setup(4);
    await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "succeeded" }] });
    const w = await seedRegistration(db, ev.id, { seats: 2, lifecycle: "waitlisted" });
    await promoteFromWaitlistAction(fd({ participantId: w.participant.id, expiresAt: warsawInputIn(120) }));
    expect(rows("SELECT kind, amount_cents AS a, status FROM payments WHERE participant_id = ?", w.participant.id)).toEqual([
      { kind: "deposit", a: 100_000, status: "pending" },
    ]);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(4);
    expect(email.sendWaitlistPromoted).not.toHaveBeenCalled();
    await afterCallbacks[0]();
    expect(email.sendWaitlistPromoted).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "kontakt@example.com" }));
  });

  it("puts the participant back on the waitlist when Stripe fails", async () => {
    const { db, ev } = await setup(4);
    const w = await seedRegistration(db, ev.id, { seats: 2, lifecycle: "waitlisted" });
    checkout.createCheckoutSession.mockRejectedValueOnce(new Error("stripe down"));
    await expect(
      promoteFromWaitlistAction(fd({ participantId: w.participant.id, expiresAt: warsawInputIn(120) })),
    ).rejects.toThrow("stripe down");
    expect(rows("SELECT lifecycle_status FROM participants")).toEqual([{ lifecycle_status: "waitlisted" }]);
    expect(rows("SELECT status FROM payments")).toEqual([{ status: "failed" }]);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(0);
  });

  it("two promotions racing for the last two seats admit only one", async () => {
    const { db, ev } = await setup(2);
    const a = await seedRegistration(db, ev.id, { seats: 2, lifecycle: "waitlisted" });
    const b = await seedRegistration(db, ev.id, { seats: 2, lifecycle: "waitlisted" });
    const results = await Promise.allSettled([
      promoteFromWaitlistAction(fd({ participantId: a.participant.id, expiresAt: warsawInputIn(120) })),
      promoteFromWaitlistAction(fd({ participantId: b.participant.id, expiresAt: warsawInputIn(120) })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(2);
  });
});

describe("resendPaymentLinkAction", () => {
  it("expires the open session before sending a new link", async () => {
    const { db, ev } = await setup();
    const r = await seedRegistration(db, ev.id, { payments: [{ status: "pending", stripeSessionId: "cs_old" }] });
    checkout.getCheckoutSessionState.mockResolvedValueOnce({
      state: "open",
      url: "https://old",
      amountCents: 50_000,
    } as never);
    await resendPaymentLinkAction(fd({ participantId: r.participant.id }));
    expect(checkout.closeCheckoutSession).toHaveBeenCalledWith("acct_test", "cs_old");
    expect(checkout.createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("works for a participant whose checkout lapsed, if there is room", async () => {
    const { db, ev } = await setup();
    const r = await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "expired" }] });
    await resendPaymentLinkAction(fd({ participantId: r.participant.id }));
    expect(rows("SELECT status FROM payments")).toEqual([{ status: "pending" }]);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(2);
  });
});

describe("cancelParticipantAction", () => {
  it("expires the open checkout session of the cancelled participant", async () => {
    const { db, ev } = await setup();
    const r = await seedRegistration(db, ev.id, { payments: [{ status: "pending", stripeSessionId: "cs_open" }] });
    await cancelParticipantAction(fd({ participantId: r.participant.id }));
    expect(checkout.closeCheckoutSession).toHaveBeenCalledWith("acct_test", "cs_open");
    expect(rows("SELECT lifecycle_status FROM participants")).toEqual([{ lifecycle_status: "cancelled" }]);
    expect(rows("SELECT status FROM payments")).toEqual([{ status: "expired" }]);
  });
});

describe("extendBalanceDeadlineAction", () => {
  it("reads the typed date as Warsaw time, not the Worker's UTC", async () => {
    const { db, ev } = await setup();
    const r = await seedRegistration(db, ev.id, {
      payments: [{ kind: "deposit", status: "succeeded" }, { kind: "balance", status: "expired" }],
    });
    const balanceId = r.payments[1].id!;
    await extendBalanceDeadlineAction(fd({ paymentId: balanceId, dueAt: "2099-07-01T12:00" }));
    expect(rows("SELECT due_at FROM payments WHERE id = ?", balanceId)).toEqual([
      { due_at: Date.UTC(2099, 6, 1, 10, 0) },
    ]);
  });
});

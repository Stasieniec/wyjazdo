import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => import("@/test/db-mock").then((m) => m.dbClientMock()));

const afterCallbacks = vi.hoisted(() => [] as (() => Promise<unknown>)[]);
vi.mock("next/server", () => ({
  after: (cb: () => Promise<unknown>) => {
    afterCallbacks.push(cb);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-proto", "https"]]),
}));
const checkout = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(async (p: { paymentId: string }) => ({
    id: `cs_${p.paymentId}`,
    url: `https://checkout.stripe.test/${p.paymentId}`,
  })),
}));
vi.mock("@/lib/stripe-checkout", () => checkout);
const email = vi.hoisted(() => ({
  sendWaitlistConfirmation: vi.fn(async () => {}),
  sendOrganizerNewRegistration: vi.fn(async () => {}),
  sendPaymentConfirmation: vi.fn(async () => {}),
}));
vi.mock("@/lib/email/send", () => email);
vi.mock("@/lib/participant-auth", () => ({
  getParticipantAuthSecret: () => "secret",
  signParticipantToken: async () => "tok",
}));

import { resetTestDb, rows, testDb } from "@/test/db-mock";
import { seedEvent, seedOrganizer, seedRegistration, DAY } from "@/test/fixtures";
import { processRegistration } from "./process-registration";
import { countTakenSpots } from "@/lib/capacity";

function form(
  ev: { id: string; slug: string },
  subdomain: string,
  opts: { email?: string; party?: number } = {},
): FormData {
  const f = new FormData();
  f.set("eventId", ev.id);
  f.set("organizerSubdomain", subdomain);
  f.set("eventSlug", ev.slug);
  f.set("firstName", "Ewa");
  f.set("lastName", "Kowalska");
  f.set("email", opts.email ?? "Ewa.Kowalska@Example.com");
  f.set("consent_regulamin", "true");
  f.set("consent_privacy", "true");
  for (let i = 0; i < (opts.party ?? 1); i++) {
    f.set(`attendees[${i}][attendeeTypeId]`, "adult");
    f.set(`attendees[${i}][firstName]`, `Osoba${i}`);
    f.set(`attendees[${i}][lastName]`, "Kowalska");
  }
  return f;
}

async function setup(eventOver: Parameters<typeof seedEvent>[2] = {}) {
  const { db } = testDb();
  const org = await seedOrganizer(db);
  const ev = await seedEvent(db, org.id, eventOver);
  return { db, org, ev: ev as typeof ev & { slug: string } };
}

beforeEach(() => {
  resetTestDb();
  afterCallbacks.length = 0;
  vi.clearAllMocks();
});

describe("processRegistration", () => {
  it("registers a pair with a deposit of 500 per person, holding two seats", async () => {
    const { org, ev } = await setup();
    const res = await processRegistration(form(ev, org.subdomain, { party: 2 }), "https:");
    expect(res).toEqual({ redirectUrl: expect.stringContaining("checkout.stripe.test") });
    expect(checkout.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 100_000, productName: "Zaliczka: Weekend dla kobiet" }),
    );
    expect(await countTakenSpots(ev.id, Date.now())).toBe(2);
    // Attendees carry the price they registered at.
    expect(rows("SELECT price_cents FROM attendees")).toEqual([
      { price_cents: 148_000 },
      { price_cents: 148_000 },
    ]);
  });

  it("stores the email in lower case", async () => {
    const { org, ev } = await setup();
    await processRegistration(form(ev, org.subdomain), "https:");
    expect(rows("SELECT email FROM participants")).toEqual([{ email: "ewa.kowalska@example.com" }]);
  });

  it("a party that does not fit goes to the waitlist as a whole, with nothing half-written", async () => {
    const { db, org, ev } = await setup({ capacity: 4 });
    await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "succeeded" }] });
    const res = await processRegistration(form(ev, org.subdomain, { party: 4 }), "https:");
    expect(res).toEqual({ redirectUrl: expect.stringContaining("waitlisted=1") });
    expect(rows("SELECT lifecycle_status FROM participants WHERE email LIKE 'ewa%'")).toEqual([
      { lifecycle_status: "waitlisted" },
    ]);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(2);
    expect(checkout.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("two pairs racing for the last three seats: one gets in, the other is waitlisted whole", async () => {
    const { db, org, ev } = await setup({ capacity: 4 });
    await seedRegistration(db, ev.id, { seats: 1, payments: [{ status: "succeeded" }] });
    await Promise.all([
      processRegistration(form(ev, org.subdomain, { party: 2, email: "a@example.com" }), "https:"),
      processRegistration(form(ev, org.subdomain, { party: 2, email: "b@example.com" }), "https:"),
    ]);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(3);
    expect(
      rows("SELECT lifecycle_status AS s FROM participants WHERE email IN ('a@example.com','b@example.com') ORDER BY s"),
    ).toEqual([{ s: "active" }, { s: "waitlisted" }]);
    // Each registration has both attendees, never a party counted as one.
    expect(rows("SELECT COUNT(*) AS n FROM attendees")).toEqual([{ n: 5 }]);
  });

  it("an abandoned checkout frees its places for the next guest (page and admission agree)", async () => {
    const { db, org, ev } = await setup({ capacity: 2 });
    await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "expired" }] });
    expect(await countTakenSpots(ev.id, Date.now())).toBe(0);
    const res = await processRegistration(form(ev, org.subdomain, { party: 2 }), "https:");
    expect(res).toEqual({ redirectUrl: expect.stringContaining("checkout.stripe.test") });
    expect(rows("SELECT lifecycle_status FROM participants WHERE email LIKE 'ewa%'")).toEqual([
      { lifecycle_status: "active" },
    ]);
  });

  it("charges the full amount when registering after the balance due date", async () => {
    const { org, ev } = await setup({ balanceDueAt: Date.now() - DAY });
    await processRegistration(form(ev, org.subdomain), "https:");
    expect(checkout.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 148_000, productName: "Weekend dla kobiet" }),
    );
    expect(rows("SELECT kind, amount_cents FROM payments")).toEqual([{ kind: "full", amount_cents: 148_000 }]);
  });

  it("refuses a total below the 2 zł minimum before writing anything", async () => {
    const { org, ev } = await setup({
      attendeeTypes: JSON.stringify([{ id: "adult", name: "U", minQty: 1, maxQty: 2, priceCents: 150 }]),
      depositCents: null,
      balanceDueAt: null,
    });
    const res = await processRegistration(form(ev, org.subdomain), "https:");
    expect(res).toHaveProperty("errors._form");
    expect(rows("SELECT id FROM participants")).toEqual([]);
  });

  it("releases the place when the checkout session cannot be created", async () => {
    const { org, ev } = await setup();
    checkout.createCheckoutSession.mockRejectedValueOnce(new Error("stripe down"));
    const res = await processRegistration(form(ev, org.subdomain, { party: 2 }), "https:");
    expect(res).toHaveProperty("errors._form");
    expect(rows("SELECT status FROM payments")).toEqual([{ status: "failed" }]);
    expect(await countTakenSpots(ev.id, Date.now())).toBe(0);
  });

  it("records consents before responding and sends emails through after()", async () => {
    const { org, ev } = await setup({ capacity: 1 });
    await seedRegistration(testDb().db, ev.id, { seats: 1, payments: [{ status: "succeeded" }] });
    await processRegistration(form(ev, org.subdomain), "https:");
    expect(rows("SELECT consent_key FROM participant_consents ORDER BY consent_key")).toEqual([
      { consent_key: "platform_privacy" },
      { consent_key: "platform_regulamin" },
    ]);
    expect(email.sendWaitlistConfirmation).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();
    expect(email.sendWaitlistConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ewa.kowalska@example.com", replyTo: "kontakt@example.com" }),
    );
  });

  it("sends a double submit back to the trip page instead of a second checkout", async () => {
    const { org, ev } = await setup();
    await processRegistration(form(ev, org.subdomain), "https:");
    const second = await processRegistration(form(ev, org.subdomain, { email: "EWA.kowalska@example.com" }), "https:");
    expect(second).toEqual({ redirectUrl: expect.stringContaining("/my-trips/") });
    expect(checkout.createCheckoutSession).toHaveBeenCalledTimes(1);
  });
});

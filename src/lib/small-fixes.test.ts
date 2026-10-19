import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => import("@/test/db-mock").then((m) => m.dbClientMock()));
const sendMagic = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/email/send", () => ({ sendMagicLinkEmail: sendMagic }));
vi.mock("@/lib/participant-auth", () => ({
  getParticipantAuthSecret: () => "secret",
  signMagicLinkOneTime: async () => "magic",
}));
const stripe = vi.hoisted(() => ({
  accountsCreate: vi.fn(async () => ({ id: "acct_new" })),
  accountLinksCreate: vi.fn(async (p: { account: string }) => ({ url: `https://connect/${p.account}` })),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    accounts: { create: stripe.accountsCreate },
    accountLinks: { create: stripe.accountLinksCreate },
  }),
}));
const headerMap = vi.hoisted(() => ({ ip: "1.1.1.1" }));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["cf-connecting-ip", headerMap.ip]]),
}));
const processRegistration = vi.hoisted(() => vi.fn(async () => ({ errors: { _form: "x" } })));
vi.mock("@/lib/register/process-registration", () => ({ processRegistration }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));

import { resetTestDb, rows, testDb } from "@/test/db-mock";
import { seedEvent, seedOrganizer, seedRegistration } from "@/test/fixtures";
import { getParticipantForEvent, listTripSummariesByEmail } from "@/lib/db/queries/participants";
import { requestMagicLink } from "@/lib/magic-link";
import { registerAction } from "@/app/sites/[subdomain]/[eventSlug]/register/actions";
import { createConnectAccountAndLink } from "@/lib/stripe-connect";
import { attendeeTypesSchema } from "@/lib/validators/attendee-types";
import { stepPaymentSchema } from "@/lib/validators/event-wizard";

beforeEach(() => {
  resetTestDb();
  vi.clearAllMocks();
});

describe("/my-trips lookup", () => {
  it("finds trips regardless of the case the guest typed", async () => {
    const { db } = testDb();
    const org = await seedOrganizer(db);
    const ev = await seedEvent(db, org.id);
    // A row written before normalisation, with mixed case.
    await seedRegistration(db, ev.id, { email: "Ewa.Kowalska@Example.com" });
    expect(await listTripSummariesByEmail("ewa.kowalska@example.com")).toHaveLength(1);
    expect(await listTripSummariesByEmail(" EWA.KOWALSKA@EXAMPLE.COM ")).toHaveLength(1);
  });
});

describe("thanks page lookup", () => {
  it("only returns a participant of the event in the URL", async () => {
    const { db } = testDb();
    const org = await seedOrganizer(db);
    const ev = await seedEvent(db, org.id);
    const other = await seedEvent(db, org.id);
    const r = await seedRegistration(db, other.id);
    expect(await getParticipantForEvent(r.participant.id, ev.id)).toBeNull();
    expect(await getParticipantForEvent(r.participant.id, other.id)).not.toBeNull();
  });
});

describe("rate limits", () => {
  it("limits magic-link requests per address", async () => {
    const results = [];
    for (let i = 0; i < 7; i++) {
      results.push(await requestMagicLink({ email: "Target@example.com", ip: `10.0.0.${i}`, origin: "https://w" }));
    }
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(sendMagic).toHaveBeenCalledTimes(5);
    expect(sendMagic).toHaveBeenCalledWith(expect.objectContaining({ to: "target@example.com" }));
  });

  it("limits the registration server action per IP and address", async () => {
    headerMap.ip = "2.2.2.2";
    const withEmail = (e: string) => {
      const f = new FormData();
      f.set("email", e);
      return f;
    };
    const out = [];
    for (let i = 0; i < 6; i++) out.push(await registerAction(null, withEmail("same@example.com")));
    expect(processRegistration).toHaveBeenCalledTimes(5);
    expect(out[5]).toEqual({ errors: { _form: "Zbyt wiele prób. Spróbuj ponownie za minutę." } });
  });

  it("lets one shared connection register several different people", async () => {
    headerMap.ip = "3.3.3.3";
    for (let i = 0; i < 10; i++) {
      const f = new FormData();
      f.set("email", `guest${i}@example.com`);
      await registerAction(null, f);
    }
    expect(processRegistration).toHaveBeenCalledTimes(10);
  });
});

describe("Połącz Stripe double click", () => {
  it("creates the Express account with an idempotency key and keeps the first stored account", async () => {
    const { db } = testDb();
    const org = await seedOrganizer(db, { stripeAccountId: null });
    await createConnectAccountAndLink({ organizerId: org.id, organizerEmail: null, returnUrl: "r", refreshUrl: "f" });
    expect(stripe.accountsCreate).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: `connect-account-${org.id}-`,
    });

    // A second click whose Stripe call returned a different id must not overwrite it.
    stripe.accountsCreate.mockResolvedValueOnce({ id: "acct_other" });
    const second = await createConnectAccountAndLink({
      organizerId: org.id,
      organizerEmail: null,
      returnUrl: "r",
      refreshUrl: "f",
    });
    expect(second.accountId).toBe("acct_new");
    expect(rows("SELECT stripe_account_id AS a FROM organizers")).toEqual([{ a: "acct_new" }]);
  });
});

describe("Stripe minimum charge at event save", () => {
  it("rejects prices between 0 and 2 zł", () => {
    const t = (priceCents: number) => [{ id: "a", name: "A", minQty: 1, maxQty: 2, priceCents }];
    expect(attendeeTypesSchema.safeParse(t(150)).success).toBe(false);
    expect(attendeeTypesSchema.safeParse(t(0)).success).toBe(true);
    expect(attendeeTypesSchema.safeParse(t(148_000)).success).toBe(true);
  });

  it("rejects a deposit below 2 zł", () => {
    expect(stepPaymentSchema.safeParse({ depositOn: true, depositCents: 100, balanceDueAt: 1 }).success).toBe(false);
    expect(stepPaymentSchema.safeParse({ depositOn: true, depositCents: 50_000, balanceDueAt: 1 }).success).toBe(true);
  });
});

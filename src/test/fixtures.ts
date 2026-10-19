/**
 * Seed helpers for tests running on the in-memory D1 (see fake-d1.ts).
 * Defaults model the first real customer: a retreat house selling
 * Friday-Sunday weekends, 16 places, 1480 PLN with a 500 PLN deposit.
 */
import type { makeTestDb } from "./fake-d1";
import * as schema from "@/lib/db/schema";
import type { NewAttendee, NewEvent, NewOrganizer, NewParticipant, NewPayment } from "@/lib/db/schema";

type Db = ReturnType<typeof makeTestDb>["db"];

let seq = 0;
export const id = (prefix: string) => `${prefix}_${++seq}`;

export const DAY = 24 * 60 * 60 * 1000;

export const ATTENDEE_TYPES = [
  { id: "adult", name: "Uczestniczka", minQty: 1, maxQty: 4, priceCents: 148_000 },
];

export async function seedOrganizer(db: Db, over: Partial<NewOrganizer> = {}) {
  const row: NewOrganizer = {
    id: id("org"),
    clerkUserId: id("clerk"),
    subdomain: id("dom"),
    displayName: "Dom nad Jeziorem",
    contactEmail: "kontakt@example.com",
    stripeAccountId: "acct_test",
    stripeOnboardingComplete: 1,
    stripePayoutsEnabled: 1,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
  await db.insert(schema.organizers).values(row);
  return row;
}

export async function seedEvent(db: Db, organizerId: string, over: Partial<NewEvent> = {}) {
  const now = Date.now();
  const row: NewEvent = {
    id: id("evt"),
    organizerId,
    slug: id("weekend"),
    title: "Weekend dla kobiet",
    location: "Mazury",
    startsAt: now + 60 * DAY,
    endsAt: now + 62 * DAY,
    priceCents: 148_000,
    capacity: 16,
    status: "published",
    attendeeTypes: JSON.stringify(ATTENDEE_TYPES),
    depositCents: 50_000,
    balanceDueAt: now + 30 * DAY,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
  await db.insert(schema.events).values(row);
  return row as NewEvent & { id: string };
}

/** A registration with `seats` attendees and the given payments. */
export async function seedRegistration(
  db: Db,
  eventId: string,
  opts: {
    seats?: number;
    lifecycle?: NewParticipant["lifecycleStatus"];
    payments?: Partial<NewPayment>[];
    email?: string;
    attendeePriceCents?: number | null;
  } = {},
) {
  const now = Date.now();
  const p: NewParticipant = {
    id: id("par"),
    eventId,
    firstName: "Anna",
    lastName: "Nowak",
    email: opts.email ?? `${id("guest")}@example.com`,
    lifecycleStatus: opts.lifecycle ?? "active",
    createdAt: now - DAY,
    updatedAt: now - DAY,
  };
  await db.insert(schema.participants).values(p);
  const seats = opts.seats ?? 1;
  const attendees: NewAttendee[] = Array.from({ length: seats }, (_, i) => ({
    id: id("att"),
    participantId: p.id,
    attendeeTypeId: "adult",
    firstName: `Osoba${i + 1}`,
    lastName: "Nowak",
    priceCents: opts.attendeePriceCents === undefined ? 148_000 : opts.attendeePriceCents,
    createdAt: now - DAY,
  }));
  if (attendees.length) await db.insert(schema.attendees).values(attendees);
  const payments: NewPayment[] = [];
  for (const over of opts.payments ?? []) {
    const pay: NewPayment = {
      id: id("pay"),
      participantId: p.id,
      kind: "deposit",
      amountCents: 50_000 * seats,
      status: "pending",
      expiresAt: now + 30 * 60 * 1000,
      createdAt: now - DAY,
      updatedAt: now - DAY,
      ...over,
    };
    await db.insert(schema.payments).values(pay);
    payments.push(pay);
  }
  return { participant: p, attendees, payments };
}

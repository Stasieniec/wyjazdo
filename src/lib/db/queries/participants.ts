import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export async function insertParticipant(row: typeof schema.participants.$inferInsert) {
  const db = getDb();
  await db.insert(schema.participants).values(row);
}

export async function setStripeSessionId(participantId: string, sessionId: string) {
  const db = getDb();
  await db
    .update(schema.participants)
    .set({ stripeSessionId: sessionId, updatedAt: Date.now() })
    .where(eq(schema.participants.id, participantId));
}

export async function getParticipantById(id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getParticipantBySessionId(sessionId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.stripeSessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listParticipantsForEvent(eventId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.eventId, eventId))
    .all();
}

/**
 * Atomically mark a pending participant as paid.
 * Returns true if this call actually transitioned the row from pending → paid.
 * Returns false if the row was already paid (e.g. webhook retry) or doesn't exist.
 *
 * Use the boolean to gate side effects like sending confirmation emails so
 * they don't fire on every Stripe webhook retry.
 */
export async function markPaidIfPending(params: {
  participantId: string;
  paymentIntentId: string;
  amountCents: number;
  paidAt: number;
}): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(schema.participants)
    .set({
      status: "paid",
      stripePaymentIntentId: params.paymentIntentId,
      amountPaidCents: params.amountCents,
      paidAt: params.paidAt,
      expiresAt: null,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(schema.participants.id, params.participantId),
        eq(schema.participants.status, "pending"),
      ),
    )
    .returning({ id: schema.participants.id });
  return updated.length > 0;
}

/**
 * Returns participant + event + organizer data for email context.
 * Used after payment confirmation or waitlist join.
 */
export async function getParticipantWithContext(participantId: string) {
  const db = getDb();
  const rows = await db
    .select({
      participant: schema.participants,
      event: schema.events,
      organizer: schema.organizers,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(eq(schema.participants.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function cancelIfPending(participantId: string) {
  const db = getDb();
  await db
    .update(schema.participants)
    .set({ status: "cancelled", updatedAt: Date.now() })
    .where(
      and(
        eq(schema.participants.id, participantId),
        eq(schema.participants.status, "pending"),
      ),
    );
}

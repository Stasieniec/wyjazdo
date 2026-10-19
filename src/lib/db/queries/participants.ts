import { and, eq, gt, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { NewAttendee, NewParticipant, NewPayment, Participant } from "@/lib/db/schema";
import { takenSeatsSql } from "@/lib/capacity";
import { changesOf, conditionalInsertSql, runAtomically } from "@/lib/db/conditional-insert";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function insertParticipantWithAttendees(
  participant: NewParticipant,
  attendees: NewAttendee[],
): Promise<void> {
  const db = getDb();
  const insertParticipant = db.insert(schema.participants).values(participant);

  if (attendees.length === 0) {
    await insertParticipant;
    return;
  }

  await db.batch([
    insertParticipant,
    db.insert(schema.attendees).values(attendees),
  ]);
}

/**
 * Registers a participant as 'active' only if the event has room, writing the
 * participant, its attendees and its first payment row in one D1 batch (one
 * transaction). Nothing can see a half-written registration, so a party of
 * four always counts as four seats, and the new payment row makes the
 * participant hold a place under the same rule the public counter uses.
 *
 * Returns false when the event is full; nothing is written in that case.
 */
export async function registerActiveParticipant(params: {
  participant: NewParticipant;
  attendees: NewAttendee[];
  payment: NewPayment;
  requestedSeats: number;
  capacity: number;
  nowMs: number;
}): Promise<boolean> {
  const db = getDb();
  const p = { ...params.participant, lifecycleStatus: "active" as const };
  const participantExists = sql`EXISTS (SELECT 1 FROM participants WHERE id = ${p.id})`;
  const results = await runAtomically(db, [
    conditionalInsertSql(
      schema.participants,
      p,
      sql`${takenSeatsSql(p.eventId, params.nowMs)} + ${params.requestedSeats} <= ${params.capacity}`,
    ),
    ...params.attendees.map((a) => conditionalInsertSql(schema.attendees, a, participantExists)),
    conditionalInsertSql(schema.payments, params.payment, participantExists),
  ]);
  return changesOf(results[0]) > 0;
}

/**
 * Moves a waitlisted participant to 'active' and creates their first payment
 * row, in one batch, only if their whole party fits. Returns false if the
 * event has no room for them (or they are no longer waitlisted).
 */
export async function promoteWaitlistedParticipant(params: {
  participantId: string;
  eventId: string;
  capacity: number;
  payment: NewPayment;
  nowMs: number;
}): Promise<boolean> {
  const db = getDb();
  const { participantId, nowMs } = params;
  const ownSeats = sql`MAX(1, (SELECT COUNT(*) FROM attendees a
    WHERE a.participant_id = ${participantId} AND a.cancelled_at IS NULL))`;
  const results = await runAtomically(db, [
    sql`UPDATE participants SET lifecycle_status = 'active', updated_at = ${nowMs}
      WHERE id = ${participantId} AND lifecycle_status = 'waitlisted'
        AND ${takenSeatsSql(params.eventId, nowMs)} + ${ownSeats} <= ${params.capacity}`,
    conditionalInsertSql(
      schema.payments,
      params.payment,
      sql`EXISTS (SELECT 1 FROM participants WHERE id = ${participantId} AND lifecycle_status = 'active')
        AND NOT EXISTS (SELECT 1 FROM payments WHERE participant_id = ${participantId}
          AND status IN ('pending', 'succeeded'))`,
    ),
  ]);
  return changesOf(results[0]) > 0;
}

/**
 * Undo a promotion whose checkout could not be created: the payment row is
 * marked failed and the participant goes back to the waitlist, so the place
 * is not left held by someone with nothing to pay.
 */
export async function revertPromotion(participantId: string, paymentId: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await runAtomically(db, [
    sql`UPDATE payments SET status = 'failed', updated_at = ${now}
      WHERE id = ${paymentId} AND status = 'pending'`,
    sql`UPDATE participants SET lifecycle_status = 'waitlisted', updated_at = ${now}
      WHERE id = ${participantId} AND lifecycle_status = 'active'
        AND NOT EXISTS (SELECT 1 FROM payments WHERE participant_id = ${participantId}
          AND status = 'succeeded')`,
  ]);
}

/**
 * Looks for a participant with the same (eventId, email) created within the
 * given window, that is not cancelled. Used for duplicate-submit dedupe.
 */
export async function findRecentParticipantForDedupe(params: {
  eventId: string;
  email: string;
  sinceMs: number;
}): Promise<Participant | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.participants)
    .where(
      and(
        eq(schema.participants.eventId, params.eventId),
        sql`lower(${schema.participants.email}) = ${normalizeEmail(params.email)}`,
        ne(schema.participants.lifecycleStatus, "cancelled"),
        gt(schema.participants.createdAt, params.sinceMs),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** A participant, only if they belong to the given event (thanks page lookups). */
export async function getParticipantForEvent(id: string, eventId: string): Promise<Participant | null> {
  const p = await getParticipantById(id);
  return p && p.eventId === eventId ? p : null;
}

export async function listParticipantsForEvent(eventId: string): Promise<Participant[]> {
  const db = getDb();
  return db.select().from(schema.participants).where(eq(schema.participants.eventId, eventId)).all();
}

export async function cancelParticipant(participantId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.participants)
    .set({ lifecycleStatus: "cancelled", updatedAt: Date.now() })
    .where(eq(schema.participants.id, participantId));
}

export async function setParticipantAttention(
  participantId: string,
  reason: NonNullable<Participant["attentionReason"]>,
  nowMs: number,
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.participants)
    .set({ attentionReason: reason, attentionAt: nowMs, updatedAt: nowMs })
    .where(eq(schema.participants.id, participantId));
}

export async function clearParticipantAttention(participantId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.participants)
    .set({ attentionReason: null, attentionAt: null, updatedAt: Date.now() })
    .where(eq(schema.participants.id, participantId));
}

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

export async function listTripSummariesByEmail(email: string) {
  const db = getDb();
  return db
    .select({
      participantId: schema.participants.id,
      lifecycleStatus: schema.participants.lifecycleStatus,
      eventTitle: schema.events.title,
      eventStartsAt: schema.events.startsAt,
      eventLocation: schema.events.location,
      organizerName: schema.organizers.displayName,
      organizerSubdomain: schema.organizers.subdomain,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(sql`lower(${schema.participants.email}) = ${normalizeEmail(email)}`)
    .all();
}

import { and, eq, gt, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { NewAttendee, NewParticipant, Participant } from "@/lib/db/schema";

export async function insertParticipant(row: NewParticipant): Promise<void> {
  const db = getDb();
  await db.insert(schema.participants).values(row);
}

export async function insertParticipantWithAttendees(
  participant: NewParticipant,
  attendees: NewAttendee[],
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(schema.participants).values(participant);
    if (attendees.length > 0) {
      await tx.insert(schema.attendees).values(attendees);
    }
  });
}

/**
 * Conditional insert of a participant as 'active' only if there is capacity.
 * Capacity is defined as: sum of non-cancelled attendee rows for 'active'
 * participants of the same event, plus 1 for any 'active' participant that
 * has no non-cancelled attendee rows (legacy single-seat registrations).
 *
 * Returns true if the row was inserted (caller should then insert attendees
 * and proceed). Returns false if the event was full (caller should insert
 * this participant as 'waitlisted' instead).
 *
 * Runs in a single SQL statement so two concurrent callers cannot both pass
 * the check for the last seat — SQLite serializes writes.
 */
export async function tryInsertActiveParticipant(params: {
  participant: NewParticipant;
  requestedSeats: number;
  capacity: number;
}): Promise<boolean> {
  const db = getDb();
  const p = params.participant;
  const res = await db.run(sql`
    INSERT INTO participants
      (id, event_id, first_name, last_name, email, phone, custom_answers, lifecycle_status, created_at, updated_at)
    SELECT
      ${p.id}, ${p.eventId}, ${p.firstName}, ${p.lastName}, ${p.email},
      ${p.phone ?? null}, ${p.customAnswers ?? null}, 'active',
      ${p.createdAt}, ${p.updatedAt}
    WHERE (
      (SELECT COUNT(*) FROM attendees a
        JOIN participants pa ON a.participant_id = pa.id
        WHERE pa.event_id = ${p.eventId}
          AND pa.lifecycle_status = 'active'
          AND a.cancelled_at IS NULL)
      +
      (SELECT COUNT(*) FROM participants pa
        WHERE pa.event_id = ${p.eventId}
          AND pa.lifecycle_status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM attendees a
            WHERE a.participant_id = pa.id AND a.cancelled_at IS NULL
          ))
      + ${params.requestedSeats}
    ) <= ${params.capacity}
  `);
  return ((res as { meta?: { changes?: number } }).meta?.changes ?? 0) > 0;
}

export async function insertAttendees(rows: NewAttendee[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();
  await db.insert(schema.attendees).values(rows);
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
        eq(schema.participants.email, params.email),
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

export async function listParticipantsForEvent(eventId: string): Promise<Participant[]> {
  const db = getDb();
  return db.select().from(schema.participants).where(eq(schema.participants.eventId, eventId)).all();
}

export async function listParticipantsByEmail(email: string): Promise<Participant[]> {
  const db = getDb();
  return db.select().from(schema.participants).where(eq(schema.participants.email, email)).all();
}

export async function cancelParticipant(participantId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.participants)
    .set({ lifecycleStatus: "cancelled", updatedAt: Date.now() })
    .where(eq(schema.participants.id, participantId));
}

export async function activateWaitlistedParticipant(participantId: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(schema.participants)
    .set({ lifecycleStatus: "active", updatedAt: Date.now() })
    .where(
      and(
        eq(schema.participants.id, participantId),
        eq(schema.participants.lifecycleStatus, "waitlisted"),
      ),
    )
    .returning({ id: schema.participants.id });
  return updated.length > 0;
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
    .where(eq(schema.participants.email, email))
    .all();
}

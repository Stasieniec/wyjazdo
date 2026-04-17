import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { Attendee, NewAttendee } from "@/lib/db/schema";

export async function insertAttendees(rows: NewAttendee[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();
  await db.insert(schema.attendees).values(rows);
}

export async function listActiveAttendeesForParticipant(
  participantId: string,
): Promise<Attendee[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.attendees)
    .where(
      and(
        eq(schema.attendees.participantId, participantId),
        isNull(schema.attendees.cancelledAt),
      ),
    )
    .all();
}

export async function listAttendeesForEvent(eventId: string): Promise<Attendee[]> {
  const db = getDb();
  return db
    .select({
      id: schema.attendees.id,
      participantId: schema.attendees.participantId,
      attendeeTypeId: schema.attendees.attendeeTypeId,
      firstName: schema.attendees.firstName,
      lastName: schema.attendees.lastName,
      customAnswers: schema.attendees.customAnswers,
      cancelledAt: schema.attendees.cancelledAt,
      createdAt: schema.attendees.createdAt,
    })
    .from(schema.attendees)
    .innerJoin(schema.participants, eq(schema.attendees.participantId, schema.participants.id))
    .where(eq(schema.participants.eventId, eventId))
    .all();
}

export async function softCancelAttendee(attendeeId: string, now: number): Promise<void> {
  const db = getDb();
  await db
    .update(schema.attendees)
    .set({ cancelledAt: now })
    .where(eq(schema.attendees.id, attendeeId));
}

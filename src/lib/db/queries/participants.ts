import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { NewParticipant, Participant } from "@/lib/db/schema";

export async function insertParticipant(row: NewParticipant): Promise<void> {
  const db = getDb();
  await db.insert(schema.participants).values(row);
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

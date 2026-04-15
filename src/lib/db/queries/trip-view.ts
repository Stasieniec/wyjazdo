import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { listPaymentsForParticipant } from "@/lib/db/queries/payments";

export async function getTripView(participantId: string) {
  const db = getDb();
  const ctx = await db
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
  const row = ctx[0];
  if (!row) return null;
  const payments = await listPaymentsForParticipant(participantId);
  return { ...row, payments };
}

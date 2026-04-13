import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export async function listEventsForOrganizer(organizerId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.events)
    .where(eq(schema.events.organizerId, organizerId))
    .orderBy(sql`${schema.events.createdAt} desc`)
    .all();
}

export async function getEventForOrganizer(organizerId: string, eventId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.organizerId, organizerId), eq(schema.events.id, eventId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function isSlugTakenForOrganizer(organizerId: string, slug: string) {
  const db = getDb();
  const rows = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(and(eq(schema.events.organizerId, organizerId), eq(schema.events.slug, slug)))
    .limit(1);
  return rows.length > 0;
}

export async function insertEvent(row: typeof schema.events.$inferInsert) {
  const db = getDb();
  await db.insert(schema.events).values(row);
}

export async function updateEvent(
  organizerId: string,
  eventId: string,
  patch: Partial<typeof schema.events.$inferInsert>,
) {
  const db = getDb();
  await db
    .update(schema.events)
    .set({ ...patch, updatedAt: Date.now() })
    .where(and(eq(schema.events.organizerId, organizerId), eq(schema.events.id, eventId)));
}

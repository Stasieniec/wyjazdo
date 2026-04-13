import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export async function getPublishedEventBySlug(organizerId: string, slug: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.events)
    .where(
      and(
        eq(schema.events.organizerId, organizerId),
        eq(schema.events.slug, slug),
        eq(schema.events.status, "published"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

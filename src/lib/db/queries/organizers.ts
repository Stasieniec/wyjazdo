import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export async function getOrganizerBySubdomain(subdomain: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.organizers)
    .where(eq(schema.organizers.subdomain, subdomain))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPublishedEventsByOrganizer(organizerId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.events)
    .where(eq(schema.events.organizerId, organizerId))
    .all()
    .then((rows) => rows.filter((e) => e.status === "published"));
}

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

export async function getOrganizerByClerkUserId(clerkUserId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.organizers)
    .where(eq(schema.organizers.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function isSubdomainTaken(subdomain: string) {
  const db = getDb();
  const rows = await db
    .select({ id: schema.organizers.id })
    .from(schema.organizers)
    .where(eq(schema.organizers.subdomain, subdomain))
    .limit(1);
  return rows.length > 0;
}

export async function createOrganizer(input: {
  id: string;
  clerkUserId: string;
  subdomain: string;
  displayName: string;
  description?: string | null;
}) {
  const db = getDb();
  const now = Date.now();
  await db.insert(schema.organizers).values({
    id: input.id,
    clerkUserId: input.clerkUserId,
    subdomain: input.subdomain,
    displayName: input.displayName,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

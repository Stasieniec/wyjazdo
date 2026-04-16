import { eq, and, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { newId } from "@/lib/ids";

export async function listPhotosForEvent(eventId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.eventPhotos)
    .where(eq(schema.eventPhotos.eventId, eventId))
    .orderBy(schema.eventPhotos.position)
    .all();
}

export async function syncEventPhotos(
  eventId: string,
  photos: { url: string; position: number }[],
) {
  const db = getDb();
  const now = Date.now();

  // Delete all existing photos for this event
  await db
    .delete(schema.eventPhotos)
    .where(eq(schema.eventPhotos.eventId, eventId));

  // Insert new set
  if (photos.length > 0) {
    await db.insert(schema.eventPhotos).values(
      photos.map((p) => ({
        id: newId(),
        eventId,
        url: p.url,
        position: p.position,
        createdAt: now,
      })),
    );
  }
}

export async function insertEventPhotos(
  eventId: string,
  photos: { url: string; position: number }[],
) {
  if (photos.length === 0) return;
  const db = getDb();
  const now = Date.now();
  await db.insert(schema.eventPhotos).values(
    photos.map((p) => ({
      id: newId(),
      eventId,
      url: p.url,
      position: p.position,
      createdAt: now,
    })),
  );
}

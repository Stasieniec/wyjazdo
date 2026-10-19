import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export async function isWebhookEventProcessed(eventId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ eventId: schema.processedWebhookEvents.eventId })
    .from(schema.processedWebhookEvents)
    .where(eq(schema.processedWebhookEvents.eventId, eventId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Marks a Stripe webhook event as handled. Written after the handler
 * finished, so a crash mid-way leaves no marker and Stripe's retry runs the
 * (idempotent) handler again. INSERT OR IGNORE covers two deliveries racing.
 */
export async function recordProcessedWebhookEvent(params: {
  eventId: string;
  eventType: string;
  nowMs: number;
}): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.processedWebhookEvents)
    .values({
      eventId: params.eventId,
      eventType: params.eventType,
      processedAt: params.nowMs,
    })
    .onConflictDoNothing();
}

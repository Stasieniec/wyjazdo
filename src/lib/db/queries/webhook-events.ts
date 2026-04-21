import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

/**
 * Records a Stripe webhook event as processed. Returns true if this is a new
 * event (caller should process), false if it was already recorded (caller
 * should short-circuit). Backed by INSERT OR IGNORE on a PRIMARY KEY.
 */
export async function recordProcessedWebhookEvent(params: {
  eventId: string;
  eventType: string;
  nowMs: number;
}): Promise<boolean> {
  const db = getDb();
  const inserted = await db
    .insert(schema.processedWebhookEvents)
    .values({
      eventId: params.eventId,
      eventType: params.eventType,
      processedAt: params.nowMs,
    })
    .onConflictDoNothing()
    .returning({ eventId: schema.processedWebhookEvents.eventId });
  return inserted.length > 0;
}

/**
 * Removes an event-id marker so Stripe's retry can reprocess it. Used when
 * the handler fails mid-processing — without this, the retry would be
 * short-circuited by the idempotency guard and the work would never run.
 */
export async function unrecordProcessedWebhookEvent(eventId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(schema.processedWebhookEvents)
    .where(eq(schema.processedWebhookEvents.eventId, eventId));
}

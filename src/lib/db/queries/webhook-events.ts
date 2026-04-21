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

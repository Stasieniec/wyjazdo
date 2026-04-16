import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { NewPayment, Payment } from "@/lib/db/schema";

export async function insertPayment(row: NewPayment): Promise<void> {
  const db = getDb();
  await db.insert(schema.payments).values(row);
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const db = getDb();
  const rows = await db.select().from(schema.payments).where(eq(schema.payments.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getPaymentByStripeSession(sessionId: string): Promise<Payment | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.stripeSessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPaymentByStripePaymentIntent(pi: string): Promise<Payment | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.stripePaymentIntentId, pi))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPaymentsForParticipant(participantId: string): Promise<Payment[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.participantId, participantId))
    .all();
}

export async function listPaymentsForParticipants(ids: string[]): Promise<Payment[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.payments)
    .where(inArray(schema.payments.participantId, ids))
    .all();
}

export async function setPaymentStripeSession(paymentId: string, sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ stripeSessionId: sessionId, updatedAt: Date.now() })
    .where(eq(schema.payments.id, paymentId));
}

export async function markPaymentSucceededIfPending(params: {
  paymentId: string;
  stripePaymentIntentId: string;
  amountCents: number;
  applicationFeeCents: number | null;
  paidAt: number;
}): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(schema.payments)
    .set({
      status: "succeeded",
      stripePaymentIntentId: params.stripePaymentIntentId,
      amountCents: params.amountCents,
      stripeApplicationFee: params.applicationFeeCents,
      paidAt: params.paidAt,
      expiresAt: null,
      updatedAt: Date.now(),
    })
    .where(and(eq(schema.payments.id, params.paymentId), eq(schema.payments.status, "pending")))
    .returning({ id: schema.payments.id });
  return updated.length > 0;
}

export async function markPaymentExpiredIfPending(paymentId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "expired", updatedAt: Date.now() })
    .where(and(eq(schema.payments.id, paymentId), eq(schema.payments.status, "pending")));
}

export async function markPaymentFailedIfPending(paymentId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "failed", updatedAt: Date.now() })
    .where(and(eq(schema.payments.id, paymentId), eq(schema.payments.status, "pending")));
}

export async function markPaymentRefunded(paymentIntentId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "refunded", updatedAt: Date.now() })
    .where(eq(schema.payments.stripePaymentIntentId, paymentIntentId));
}

export async function setPaymentLastReminderAt(paymentId: string, at: number): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ lastReminderAt: at, updatedAt: Date.now() })
    .where(eq(schema.payments.id, paymentId));
}

export async function setBalanceDueAtForPayment(paymentId: string, at: number): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ dueAt: at, updatedAt: Date.now() })
    .where(eq(schema.payments.id, paymentId));
}

export async function resetPaymentToPending(paymentId: string, expiresAt: number): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "pending", expiresAt, updatedAt: Date.now() })
    .where(eq(schema.payments.id, paymentId));
}

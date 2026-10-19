import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { NewPayment, Payment } from "@/lib/db/schema";
import { takenSeatsSql } from "@/lib/capacity";
import { changesOf, conditionalInsertSql, runAtomically } from "@/lib/db/conditional-insert";

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

/**
 * Records a success and everything that follows from it in one batch, so a
 * crash cannot leave the money recorded without the consequences:
 * - the payment becomes succeeded (wins over pending/failed/expired);
 * - a cancelled participant is flagged 'paid_while_cancelled';
 * - a waitlisted participant becomes active;
 * - if the participant did not hold a place before this payment
 *   (heldPlaceBefore false) and the event is now over capacity, they are
 *   flagged 'overbooked'. Guests who already held a place are never flagged.
 * Every follow-up statement only fires if statement 1 changed this row in
 * this batch (matched by the exact updated_at stamp and payment intent).
 * Returns whether the payment row transitioned.
 */
export async function recordSuccessAtomically(params: {
  paymentId: string;
  participantId: string;
  eventId: string;
  capacity: number;
  stripePaymentIntentId: string;
  amountCents: number;
  paidAt: number;
  heldPlaceBefore: boolean;
  nowMs: number;
}): Promise<boolean> {
  const db = getDb();
  const stamp = params.nowMs;
  const justPaid = sql`EXISTS (SELECT 1 FROM payments jp WHERE jp.id = ${params.paymentId}
    AND jp.status = 'succeeded' AND jp.updated_at = ${stamp}
    AND jp.stripe_payment_intent_id IS ${params.stripePaymentIntentId})`;
  const statements = [
    sql`UPDATE payments SET status = 'succeeded', stripe_payment_intent_id = ${params.stripePaymentIntentId},
        amount_cents = ${params.amountCents}, stripe_application_fee = NULL, paid_at = ${params.paidAt},
        expires_at = NULL, updated_at = ${stamp}
      WHERE id = ${params.paymentId} AND status IN ('pending', 'failed', 'expired')`,
    sql`UPDATE participants SET attention_reason = 'paid_while_cancelled', attention_at = ${stamp}
      WHERE id = ${params.participantId} AND lifecycle_status = 'cancelled' AND ${justPaid}`,
    sql`UPDATE participants SET lifecycle_status = 'active', updated_at = ${stamp}
      WHERE id = ${params.participantId} AND lifecycle_status = 'waitlisted' AND ${justPaid}`,
  ];
  if (!params.heldPlaceBefore) {
    statements.push(sql`UPDATE participants SET attention_reason = 'overbooked', attention_at = ${stamp}
      WHERE id = ${params.participantId} AND lifecycle_status = 'active' AND attention_reason IS NULL
        AND ${justPaid}
        AND ${takenSeatsSql(params.eventId, params.nowMs)} > ${params.capacity}`);
  }
  const results = await runAtomically(db, statements);
  return changesOf(results[0]) > 0;
}

/**
 * Expire/fail only if the row still points at the checkout session the event
 * is about. A row that has moved on to a newer session must not be touched
 * by the old session's expiry.
 */
export async function markPaymentExpiredIfPending(paymentId: string, sessionId: string | null): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "expired", updatedAt: Date.now() })
    .where(
      and(
        eq(schema.payments.id, paymentId),
        eq(schema.payments.status, "pending"),
        sessionId == null ? sql`1 = 1` : eq(schema.payments.stripeSessionId, sessionId),
      ),
    );
}

/**
 * Releases a row whose checkout could not be created. Only touches a row that
 * still has no session, so a concurrent request that already attached a live
 * checkout to the row is left alone.
 */
export async function markPendingWithoutSessionFailed(paymentId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "failed", updatedAt: Date.now() })
    .where(
      and(
        eq(schema.payments.id, paymentId),
        eq(schema.payments.status, "pending"),
        isNull(schema.payments.stripeSessionId),
      ),
    );
}

export async function markPaymentFailedIfPending(paymentId: string, sessionId: string | null): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "failed", updatedAt: Date.now() })
    .where(
      and(
        eq(schema.payments.id, paymentId),
        eq(schema.payments.status, "pending"),
        sessionId == null ? sql`1 = 1` : eq(schema.payments.stripeSessionId, sessionId),
      ),
    );
}

/**
 * Records a refund on the payment with this PaymentIntent. `amountRefundedCents`
 * is cumulative (Stripe's charge.amount_refunded). The row only becomes
 * 'refunded' once fully refunded; a partial refund keeps it 'succeeded' with
 * the refunded part recorded.
 */
export async function recordPaymentRefund(params: {
  paymentIntentId: string;
  amountRefundedCents: number;
  fullyRefunded: boolean;
}): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({
      // Cumulative amount; events can arrive out of order, so never go down.
      refundedAmountCents: sql`MAX(${schema.payments.refundedAmountCents}, ${params.amountRefundedCents})`,
      ...(params.fullyRefunded ? { status: "refunded" as const } : {}),
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(schema.payments.stripePaymentIntentId, params.paymentIntentId),
        inArray(schema.payments.status, ["succeeded", "refunded"]),
      ),
    );
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

/**
 * Re-opens a payment row for a new checkout with a fresh amount. Used for a
 * balance row (reuse instead of inserting a second one) and for a first
 * payment that is still pending. Clears the session id so a late expiry of
 * the old session cannot flip the row.
 */
export async function reopenPayment(params: {
  paymentId: string;
  kind: Payment["kind"];
  amountCents: number;
  expiresAt: number;
  allowedStatuses: Payment["status"][];
  /**
   * The session id the caller saw on the row. The update only happens if the
   * row still has it, so two concurrent requests cannot both re-open the row
   * and each create a checkout.
   */
  expectedSessionId: string | null;
  /** If set, the row must still be payable (not expired) at this time. */
  liveAt?: number;
}): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(schema.payments)
    .set({
      status: "pending",
      kind: params.kind,
      amountCents: params.amountCents,
      expiresAt: params.expiresAt,
      stripeSessionId: null,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(schema.payments.id, params.paymentId),
        inArray(schema.payments.status, params.allowedStatuses),
        params.expectedSessionId == null
          ? isNull(schema.payments.stripeSessionId)
          : eq(schema.payments.stripeSessionId, params.expectedSessionId),
        params.liveAt == null
          ? sql`1 = 1`
          : sql`(${schema.payments.expiresAt} IS NULL OR ${schema.payments.expiresAt} > ${params.liveAt})`,
      ),
    )
    .returning({ id: schema.payments.id });
  return updated.length > 0;
}

/**
 * Re-opens an expired/failed first payment, but only if the participant's
 * party still fits: the participant stopped holding a place when the payment
 * lapsed, so re-opening it takes a place again and needs the same capacity
 * check as a new registration.
 */
export async function reopenFirstPaymentIfRoom(params: {
  paymentId: string;
  participantId: string;
  eventId: string;
  capacity: number;
  kind: Payment["kind"];
  amountCents: number;
  expiresAt: number;
  nowMs: number;
  /** Session id the caller saw; guards against two concurrent re-opens. */
  expectedSessionId: string | null;
}): Promise<boolean> {
  const db = getDb();
  const { participantId, nowMs } = params;
  const ownSeats = sql`MAX(1, (SELECT COUNT(*) FROM attendees a
    WHERE a.participant_id = ${participantId} AND a.cancelled_at IS NULL))`;
  const res = await db.run(sql`UPDATE payments SET status = 'pending', kind = ${params.kind},
      amount_cents = ${params.amountCents}, expires_at = ${params.expiresAt},
      stripe_session_id = NULL, updated_at = ${nowMs}
    WHERE id = ${params.paymentId}
      AND participant_id = ${participantId}
      AND stripe_session_id IS ${params.expectedSessionId}
      AND (status IN ('expired', 'failed')
        OR (status = 'pending' AND expires_at IS NOT NULL AND expires_at <= ${nowMs}))
      AND EXISTS (SELECT 1 FROM participants WHERE id = ${participantId} AND lifecycle_status = 'active')
      AND NOT EXISTS (SELECT 1 FROM payments o WHERE o.participant_id = ${participantId}
        AND (o.status IN ('succeeded', 'refunded')
          OR (o.status = 'pending' AND (o.expires_at IS NULL OR o.expires_at > ${nowMs}))))
      AND ${takenSeatsSql(params.eventId, nowMs)} + ${ownSeats} <= ${params.capacity}`);
  return changesOf(res) > 0;
}

/**
 * Inserts a balance row unless the participant already has one that is not
 * refunded. Keeps at most one live balance row even under double clicks.
 */
export async function insertBalancePaymentIfAbsent(row: NewPayment): Promise<boolean> {
  const db = getDb();
  const res = await db.run(
    conditionalInsertSql(
      schema.payments,
      row,
      sql`NOT EXISTS (SELECT 1 FROM payments WHERE participant_id = ${row.participantId}
        AND kind = 'balance' AND status != 'refunded')`,
    ),
  );
  return changesOf(res) > 0;
}

/** Marks every pending payment of a participant expired (used on cancel). */
export async function expirePendingPaymentsForParticipant(participantId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "expired", updatedAt: Date.now() })
    .where(
      and(eq(schema.payments.participantId, participantId), eq(schema.payments.status, "pending")),
    );
}

/** Used by the cleanup cron: pending rows past their expiry become expired. */
export async function expireStalePendingPayments(nowMs: number): Promise<void> {
  const db = getDb();
  await db.run(sql`UPDATE payments SET status = 'expired', updated_at = ${nowMs}
    WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ${nowMs}`);
}

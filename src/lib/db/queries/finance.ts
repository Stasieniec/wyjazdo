import { desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { derivedStatus } from "@/lib/participant-status";

/**
 * All financial data aggregates live here. Everything scoped to a single
 * organizer — callers must pass the organizerId they own.
 */

export type FinanceSummary = {
  totalRevenueCents: number;
  paidCount: number;
  refundedCents: number;
  refundedCount: number;
};

export async function getFinanceSummary(organizerId: string): Promise<FinanceSummary> {
  const db = getDb();
  const now = Date.now();

  // Load all participants for the organizer's events
  const participantRows = await db
    .select({
      participant: schema.participants,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .where(eq(schema.events.organizerId, organizerId))
    .all();

  const participantIds = participantRows.map((r) => r.participant.id);

  // Load all payments for these participants
  const allPayments =
    participantIds.length > 0
      ? await db
          .select()
          .from(schema.payments)
          .where(inArray(schema.payments.participantId, participantIds))
          .all()
      : [];

  const paymentsByParticipant = new Map<string, typeof allPayments>();
  for (const pay of allPayments) {
    const list = paymentsByParticipant.get(pay.participantId) ?? [];
    list.push(pay);
    paymentsByParticipant.set(pay.participantId, list);
  }

  const summary: FinanceSummary = {
    totalRevenueCents: 0,
    paidCount: 0,
    refundedCents: 0,
    refundedCount: 0,
  };

  for (const { participant } of participantRows) {
    const payments = paymentsByParticipant.get(participant.id) ?? [];
    const ds = derivedStatus(participant, payments, now);

    const succeededAmount = payments
      .filter((p) => p.status === "succeeded")
      .reduce((sum, p) => sum + p.amountCents, 0);

    const refundedAmount = payments
      .filter((p) => p.status === "refunded")
      .reduce((sum, p) => sum + p.amountCents, 0);

    if (ds === "paid" || ds === "deposit_paid") {
      summary.totalRevenueCents += succeededAmount;
      summary.paidCount += 1;
    }
    if (ds === "refunded") {
      summary.refundedCents += refundedAmount;
      summary.refundedCount += 1;
    }
  }

  return summary;
}

export type EventRevenue = {
  eventId: string;
  title: string;
  slug: string;
  paidCount: number;
  capacity: number;
  revenueCents: number;
};

/** Per-event revenue breakdown, sorted by revenue DESC. Includes only events that have at least one paid participant. */
export async function getRevenueByEvent(organizerId: string): Promise<EventRevenue[]> {
  const db = getDb();
  const now = Date.now();

  // Load all events for the organizer
  const events = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.organizerId, organizerId))
    .all();

  const result: EventRevenue[] = [];

  for (const event of events) {
    // Load participants for this event
    const participants = await db
      .select()
      .from(schema.participants)
      .where(eq(schema.participants.eventId, event.id))
      .all();

    const participantIds = participants.map((p) => p.id);

    const payments =
      participantIds.length > 0
        ? await db
            .select()
            .from(schema.payments)
            .where(inArray(schema.payments.participantId, participantIds))
            .all()
        : [];

    const paymentsByParticipant = new Map<string, typeof payments>();
    for (const pay of payments) {
      const list = paymentsByParticipant.get(pay.participantId) ?? [];
      list.push(pay);
      paymentsByParticipant.set(pay.participantId, list);
    }

    let paidCount = 0;
    let revenueCents = 0;

    for (const participant of participants) {
      const participantPayments = paymentsByParticipant.get(participant.id) ?? [];
      const ds = derivedStatus(participant, participantPayments, now);
      if (ds === "paid" || ds === "deposit_paid") {
        paidCount += 1;
        revenueCents += participantPayments
          .filter((p) => p.status === "succeeded")
          .reduce((sum, p) => sum + p.amountCents, 0);
      }
    }

    if (paidCount > 0) {
      result.push({
        eventId: event.id,
        title: event.title,
        slug: event.slug,
        capacity: event.capacity,
        paidCount,
        revenueCents,
      });
    }
  }

  return result.sort((a, b) => b.revenueCents - a.revenueCents);
}

export type RecentPayment = {
  participantId: string;
  firstName: string;
  lastName: string;
  email: string;
  amountCents: number;
  paidAt: number;
  eventId: string;
  eventTitle: string;
};

export async function getRecentPayments(
  organizerId: string,
  limit = 20,
): Promise<RecentPayment[]> {
  const db = getDb();

  // Join payments -> participants -> events to get recent succeeded payments
  const rows = await db
    .select({
      participantId: schema.participants.id,
      firstName: schema.participants.firstName,
      lastName: schema.participants.lastName,
      email: schema.participants.email,
      amountCents: schema.payments.amountCents,
      paidAt: schema.payments.paidAt,
      eventId: schema.events.id,
      eventTitle: schema.events.title,
    })
    .from(schema.payments)
    .innerJoin(schema.participants, eq(schema.payments.participantId, schema.participants.id))
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .where(eq(schema.events.organizerId, organizerId))
    .orderBy(desc(schema.payments.paidAt))
    .limit(limit)
    .all();

  return rows
    .filter((r) => r.paidAt !== null && r.amountCents !== null)
    .map((r) => ({
      participantId: r.participantId,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      amountCents: r.amountCents,
      paidAt: r.paidAt as number,
      eventId: r.eventId,
      eventTitle: r.eventTitle,
    }));
}

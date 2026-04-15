import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

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

  // Sum amountPaidCents grouped by status across all of the organizer's events.
  const rows = await db
    .select({
      status: schema.participants.status,
      total: sql<number>`COALESCE(SUM(${schema.participants.amountPaidCents}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .where(eq(schema.events.organizerId, organizerId))
    .groupBy(schema.participants.status)
    .all();

  const summary: FinanceSummary = {
    totalRevenueCents: 0,
    paidCount: 0,
    refundedCents: 0,
    refundedCount: 0,
  };

  for (const row of rows) {
    if (row.status === "paid") {
      summary.totalRevenueCents = Number(row.total);
      summary.paidCount = Number(row.count);
    } else if (row.status === "refunded") {
      summary.refundedCents = Number(row.total);
      summary.refundedCount = Number(row.count);
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
  const rows = await db
    .select({
      eventId: schema.events.id,
      title: schema.events.title,
      slug: schema.events.slug,
      capacity: schema.events.capacity,
      paidCount: sql<number>`COUNT(CASE WHEN ${schema.participants.status} = 'paid' THEN 1 END)`,
      revenueCents: sql<number>`COALESCE(SUM(CASE WHEN ${schema.participants.status} = 'paid' THEN ${schema.participants.amountPaidCents} END), 0)`,
    })
    .from(schema.events)
    .leftJoin(schema.participants, eq(schema.participants.eventId, schema.events.id))
    .where(eq(schema.events.organizerId, organizerId))
    .groupBy(schema.events.id)
    .all();

  return rows
    .map((r) => ({
      eventId: r.eventId,
      title: r.title,
      slug: r.slug,
      capacity: r.capacity,
      paidCount: Number(r.paidCount),
      revenueCents: Number(r.revenueCents),
    }))
    .filter((r) => r.paidCount > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents);
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
  const rows = await db
    .select({
      participantId: schema.participants.id,
      firstName: schema.participants.firstName,
      lastName: schema.participants.lastName,
      email: schema.participants.email,
      amountCents: schema.participants.amountPaidCents,
      paidAt: schema.participants.paidAt,
      eventId: schema.events.id,
      eventTitle: schema.events.title,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .where(
      and(
        eq(schema.events.organizerId, organizerId),
        eq(schema.participants.status, "paid"),
      ),
    )
    .orderBy(desc(schema.participants.paidAt))
    .limit(limit)
    .all();

  return rows
    .filter((r) => r.paidAt !== null && r.amountCents !== null)
    .map((r) => ({
      participantId: r.participantId,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      amountCents: r.amountCents as number,
      paidAt: r.paidAt as number,
      eventId: r.eventId,
      eventTitle: r.eventTitle,
    }));
}

import { sql, eq, and, gt, gte, desc, like, or, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { Organizer, Event as EventRow, Payment, Attendee } from "@/lib/db/schema";

// Timestamps in this DB are stored as Date.now() milliseconds.
function daysAgoMs(n: number, nowMs: number = Date.now()): number {
  return nowMs - n * 86_400_000;
}

// ── Overview ───────────────────────────────────────────────────────────────

export type OverviewStats = {
  organizers: { total: number; new7d: number; new30d: number; active: number };
  events: {
    total: number;
    upcomingPublished: number;
    draft: number;
    published: number;
    archived: number;
  };
  participants: { totalActive: number; new7d: number; new30d: number };
  payments: {
    succeededAllCount: number;
    succeededAllSumCents: number;
    succeeded30dCount: number;
    succeeded30dSumCents: number;
    succeeded7dCount: number;
    succeeded7dSumCents: number;
    pendingCount: number;
    failedCount: number;
  };
};

export async function getOverviewStats(): Promise<OverviewStats> {
  const db = getDb();
  const nowMs = Date.now();
  const d7 = daysAgoMs(7, nowMs);
  const d30 = daysAgoMs(30, nowMs);

  const [
    orgTotal,
    orgNew7,
    orgNew30,
    orgActive,
    eventCounts,
    eventUpcoming,
    partTotal,
    partNew7,
    partNew30,
    paySucceededAll,
    paySucceeded30,
    paySucceeded7,
    payPending,
    payFailed,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(schema.organizers).get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.organizers)
      .where(gte(schema.organizers.createdAt, d7))
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.organizers)
      .where(gte(schema.organizers.createdAt, d30))
      .get(),
    db
      .select({ c: sql<number>`count(distinct ${schema.events.organizerId})` })
      .from(schema.events)
      .where(eq(schema.events.status, "published"))
      .get(),
    db
      .select({ status: schema.events.status, c: sql<number>`count(*)` })
      .from(schema.events)
      .groupBy(schema.events.status)
      .all(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.events)
      .where(and(eq(schema.events.status, "published"), gt(schema.events.startsAt, nowMs)))
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.participants)
      .where(eq(schema.participants.lifecycleStatus, "active"))
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.participants)
      .where(
        and(eq(schema.participants.lifecycleStatus, "active"), gte(schema.participants.createdAt, d7)),
      )
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.participants)
      .where(
        and(eq(schema.participants.lifecycleStatus, "active"), gte(schema.participants.createdAt, d30)),
      )
      .get(),
    db
      .select({
        c: sql<number>`count(*)`,
        s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)`,
      })
      .from(schema.payments)
      .where(eq(schema.payments.status, "succeeded"))
      .get(),
    db
      .select({
        c: sql<number>`count(*)`,
        s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)`,
      })
      .from(schema.payments)
      .where(and(eq(schema.payments.status, "succeeded"), gte(schema.payments.paidAt, d30)))
      .get(),
    db
      .select({
        c: sql<number>`count(*)`,
        s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)`,
      })
      .from(schema.payments)
      .where(and(eq(schema.payments.status, "succeeded"), gte(schema.payments.paidAt, d7)))
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.payments)
      .where(eq(schema.payments.status, "pending"))
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.payments)
      .where(eq(schema.payments.status, "failed"))
      .get(),
  ]);

  const eventByStatus = { draft: 0, published: 0, archived: 0 };
  let eventsTotal = 0;
  for (const row of eventCounts) {
    eventByStatus[row.status as "draft" | "published" | "archived"] = row.c;
    eventsTotal += row.c;
  }

  return {
    organizers: {
      total: orgTotal?.c ?? 0,
      new7d: orgNew7?.c ?? 0,
      new30d: orgNew30?.c ?? 0,
      active: orgActive?.c ?? 0,
    },
    events: {
      total: eventsTotal,
      upcomingPublished: eventUpcoming?.c ?? 0,
      draft: eventByStatus.draft,
      published: eventByStatus.published,
      archived: eventByStatus.archived,
    },
    participants: {
      totalActive: partTotal?.c ?? 0,
      new7d: partNew7?.c ?? 0,
      new30d: partNew30?.c ?? 0,
    },
    payments: {
      succeededAllCount: paySucceededAll?.c ?? 0,
      succeededAllSumCents: paySucceededAll?.s ?? 0,
      succeeded30dCount: paySucceeded30?.c ?? 0,
      succeeded30dSumCents: paySucceeded30?.s ?? 0,
      succeeded7dCount: paySucceeded7?.c ?? 0,
      succeeded7dSumCents: paySucceeded7?.s ?? 0,
      pendingCount: payPending?.c ?? 0,
      failedCount: payFailed?.c ?? 0,
    },
  };
}

// ── Recent lists ───────────────────────────────────────────────────────────

export type RecentOrganizer = {
  id: string;
  displayName: string;
  subdomain: string;
  contactEmail: string | null;
  createdAt: number;
  stripeOnboardingComplete: boolean;
};

export async function getRecentOrganizers(limit = 10): Promise<RecentOrganizer[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.organizers.id,
      displayName: schema.organizers.displayName,
      subdomain: schema.organizers.subdomain,
      contactEmail: schema.organizers.contactEmail,
      createdAt: schema.organizers.createdAt,
      stripeOnboardingComplete: schema.organizers.stripeOnboardingComplete,
    })
    .from(schema.organizers)
    .orderBy(desc(schema.organizers.createdAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({ ...r, stripeOnboardingComplete: r.stripeOnboardingComplete === 1 }));
}

export type RecentPayment = {
  paymentId: string;
  amountCents: number;
  currency: string;
  paidAt: number;
  organizerId: string;
  organizerDisplayName: string;
  eventId: string;
  eventTitle: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
};

export async function getRecentSucceededPayments(limit = 10): Promise<RecentPayment[]> {
  const db = getDb();
  const rows = await db
    .select({
      paymentId: schema.payments.id,
      amountCents: schema.payments.amountCents,
      currency: schema.payments.currency,
      paidAt: schema.payments.paidAt,
      participantId: schema.participants.id,
      firstName: schema.participants.firstName,
      lastName: schema.participants.lastName,
      participantEmail: schema.participants.email,
      eventId: schema.events.id,
      eventTitle: schema.events.title,
      organizerId: schema.organizers.id,
      organizerDisplayName: schema.organizers.displayName,
    })
    .from(schema.payments)
    .innerJoin(schema.participants, eq(schema.payments.participantId, schema.participants.id))
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(eq(schema.payments.status, "succeeded"))
    .orderBy(desc(schema.payments.paidAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({
    paymentId: r.paymentId,
    amountCents: r.amountCents,
    currency: r.currency,
    paidAt: r.paidAt ?? 0,
    organizerId: r.organizerId,
    organizerDisplayName: r.organizerDisplayName,
    eventId: r.eventId,
    eventTitle: r.eventTitle,
    participantId: r.participantId,
    participantName: `${r.firstName} ${r.lastName}`.trim(),
    participantEmail: r.participantEmail,
  }));
}

// ── Organizer list with aggregates ─────────────────────────────────────────

export type OrganizerListRow = {
  id: string;
  displayName: string;
  subdomain: string;
  contactEmail: string | null;
  eventCount: number;
  participantCount: number;
  revenueCents: number;
  stripeOnboardingComplete: boolean;
  createdAt: number;
};

export type OrganizerListSort = "displayName" | "events" | "participants" | "revenue" | "created";
export type SortDir = "asc" | "desc";

export async function listOrganizers(params: {
  q?: string;
  page: number;
  pageSize: number;
  sort?: OrganizerListSort;
  dir?: SortDir;
}): Promise<{ rows: OrganizerListRow[]; totalCount: number }> {
  const db = getDb();
  const sort: OrganizerListSort = params.sort ?? "created";
  const dir: SortDir = params.dir ?? "desc";
  const offset = Math.max(0, (params.page - 1) * params.pageSize);

  const qPattern = params.q ? `%${params.q.toLowerCase()}%` : null;
  const whereExpr = qPattern
    ? or(
        like(sql`lower(${schema.organizers.displayName})`, qPattern),
        like(sql`lower(${schema.organizers.subdomain})`, qPattern),
        like(sql`lower(${schema.organizers.contactEmail})`, qPattern),
      )
    : undefined;

  const totalRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.organizers)
    .where(whereExpr)
    .get();
  const totalCount = totalRow?.c ?? 0;

  const eventCountSql = sql<number>`(
    select count(*) from ${schema.events} where ${schema.events.organizerId} = ${schema.organizers.id}
  )`;
  const participantCountSql = sql<number>`(
    select count(*) from ${schema.participants}
    inner join ${schema.events} on ${schema.participants.eventId} = ${schema.events.id}
    where ${schema.events.organizerId} = ${schema.organizers.id}
      and ${schema.participants.lifecycleStatus} = 'active'
  )`;
  const revenueSql = sql<number>`(
    select coalesce(sum(${schema.payments.amountCents}), 0) from ${schema.payments}
    inner join ${schema.participants} on ${schema.payments.participantId} = ${schema.participants.id}
    inner join ${schema.events} on ${schema.participants.eventId} = ${schema.events.id}
    where ${schema.events.organizerId} = ${schema.organizers.id}
      and ${schema.payments.status} = 'succeeded'
  )`;

  const orderExpr = (() => {
    const a = dir === "asc";
    switch (sort) {
      case "displayName":
        return a ? sql`${schema.organizers.displayName} asc` : sql`${schema.organizers.displayName} desc`;
      case "events":
        return a ? sql`event_count asc` : sql`event_count desc`;
      case "participants":
        return a ? sql`participant_count asc` : sql`participant_count desc`;
      case "revenue":
        return a ? sql`revenue_cents asc` : sql`revenue_cents desc`;
      case "created":
      default:
        return a ? sql`${schema.organizers.createdAt} asc` : sql`${schema.organizers.createdAt} desc`;
    }
  })();

  const rows = await db
    .select({
      id: schema.organizers.id,
      displayName: schema.organizers.displayName,
      subdomain: schema.organizers.subdomain,
      contactEmail: schema.organizers.contactEmail,
      stripeOnboardingComplete: schema.organizers.stripeOnboardingComplete,
      createdAt: schema.organizers.createdAt,
      event_count: eventCountSql.as("event_count"),
      participant_count: participantCountSql.as("participant_count"),
      revenue_cents: revenueSql.as("revenue_cents"),
    })
    .from(schema.organizers)
    .where(whereExpr)
    .orderBy(orderExpr)
    .limit(params.pageSize)
    .offset(offset)
    .all();

  return {
    totalCount,
    rows: rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      subdomain: r.subdomain,
      contactEmail: r.contactEmail,
      eventCount: Number(r.event_count) || 0,
      participantCount: Number(r.participant_count) || 0,
      revenueCents: Number(r.revenue_cents) || 0,
      stripeOnboardingComplete: r.stripeOnboardingComplete === 1,
      createdAt: r.createdAt,
    })),
  };
}

// ── Organizer detail ───────────────────────────────────────────────────────

export type OrganizerEventRow = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  startsAt: number;
  endsAt: number;
  capacity: number;
  registeredCount: number;
  revenueCents: number;
  createdAt: number;
};

export type OrganizerDetail = {
  organizer: Organizer;
  stats: {
    eventsByStatus: { draft: number; published: number; archived: number };
    activeParticipants: number;
    revenueCents: number;
  };
  events: OrganizerEventRow[];
};

export async function getOrganizerDetail(organizerId: string): Promise<OrganizerDetail | null> {
  const db = getDb();

  const organizer = await db
    .select()
    .from(schema.organizers)
    .where(eq(schema.organizers.id, organizerId))
    .get();
  if (!organizer) return null;

  const [eventStatusRows, activeParticipantsRow, revenueRow, eventRows] = await Promise.all([
    db
      .select({ status: schema.events.status, c: sql<number>`count(*)` })
      .from(schema.events)
      .where(eq(schema.events.organizerId, organizerId))
      .groupBy(schema.events.status)
      .all(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.participants)
      .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
      .where(
        and(
          eq(schema.events.organizerId, organizerId),
          eq(schema.participants.lifecycleStatus, "active"),
        ),
      )
      .get(),
    db
      .select({ s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)` })
      .from(schema.payments)
      .innerJoin(schema.participants, eq(schema.payments.participantId, schema.participants.id))
      .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
      .where(
        and(eq(schema.events.organizerId, organizerId), eq(schema.payments.status, "succeeded")),
      )
      .get(),
    db
      .select({
        id: schema.events.id,
        title: schema.events.title,
        slug: schema.events.slug,
        status: schema.events.status,
        startsAt: schema.events.startsAt,
        endsAt: schema.events.endsAt,
        capacity: schema.events.capacity,
        createdAt: schema.events.createdAt,
        registered: sql<number>`(
          select count(*) from ${schema.participants}
          where ${schema.participants.eventId} = ${schema.events.id}
            and ${schema.participants.lifecycleStatus} = 'active'
        )`.as("registered"),
        revenue: sql<number>`(
          select coalesce(sum(${schema.payments.amountCents}), 0) from ${schema.payments}
          inner join ${schema.participants} on ${schema.payments.participantId} = ${schema.participants.id}
          where ${schema.participants.eventId} = ${schema.events.id}
            and ${schema.payments.status} = 'succeeded'
        )`.as("revenue"),
      })
      .from(schema.events)
      .where(eq(schema.events.organizerId, organizerId))
      .orderBy(desc(schema.events.startsAt))
      .all(),
  ]);

  const eventsByStatus = { draft: 0, published: 0, archived: 0 };
  for (const r of eventStatusRows) {
    eventsByStatus[r.status as "draft" | "published" | "archived"] = r.c;
  }

  return {
    organizer,
    stats: {
      eventsByStatus,
      activeParticipants: activeParticipantsRow?.c ?? 0,
      revenueCents: revenueRow?.s ?? 0,
    },
    events: eventRows.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      status: e.status,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      capacity: e.capacity,
      registeredCount: Number(e.registered) || 0,
      revenueCents: Number(e.revenue) || 0,
      createdAt: e.createdAt,
    })),
  };
}

// ── Event detail ───────────────────────────────────────────────────────────

export type EventDetailParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  lifecycleStatus: "active" | "waitlisted" | "cancelled";
  createdAt: number;
  activeAttendeeCount: number;
  paidCents: number;
  outstandingCents: number;
  attendees: Attendee[];
  payments: Payment[];
};

export type EventDetail = {
  event: EventRow;
  organizer: { id: string; displayName: string; subdomain: string };
  aggregates: {
    registered: number;
    waitlisted: number;
    cancelled: number;
    activeAttendees: number;
    succeededSumCents: number;
    pendingSumCents: number;
    refundedSumCents: number;
  };
  participants: EventDetailParticipant[];
  payments: Array<Payment & { participantName: string; participantEmail: string }>;
};

export async function getEventDetail(eventId: string): Promise<EventDetail | null> {
  const db = getDb();

  const event = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .get();
  if (!event) return null;

  const organizer = await db
    .select({
      id: schema.organizers.id,
      displayName: schema.organizers.displayName,
      subdomain: schema.organizers.subdomain,
    })
    .from(schema.organizers)
    .where(eq(schema.organizers.id, event.organizerId))
    .get();
  if (!organizer) return null;

  const participants = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.eventId, eventId))
    .orderBy(desc(schema.participants.createdAt))
    .all();

  const participantIds = participants.map((p) => p.id);

  const [attendees, payments] = await Promise.all([
    participantIds.length > 0
      ? db
          .select()
          .from(schema.attendees)
          .where(inArray(schema.attendees.participantId, participantIds))
          .all()
      : Promise.resolve([] as Attendee[]),
    participantIds.length > 0
      ? db
          .select()
          .from(schema.payments)
          .where(inArray(schema.payments.participantId, participantIds))
          .orderBy(desc(schema.payments.createdAt))
          .all()
      : Promise.resolve([] as Payment[]),
  ]);

  const attendeesByParticipant = new Map<string, Attendee[]>();
  for (const a of attendees) {
    const list = attendeesByParticipant.get(a.participantId) ?? [];
    list.push(a);
    attendeesByParticipant.set(a.participantId, list);
  }
  const paymentsByParticipant = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = paymentsByParticipant.get(p.participantId) ?? [];
    list.push(p);
    paymentsByParticipant.set(p.participantId, list);
  }

  const participantsOut: EventDetailParticipant[] = participants.map((p) => {
    const pAtt = attendeesByParticipant.get(p.id) ?? [];
    const pPay = paymentsByParticipant.get(p.id) ?? [];
    const paidCents = pPay
      .filter((x) => x.status === "succeeded")
      .reduce((s, x) => s + x.amountCents, 0);
    const outstandingCents = pPay
      .filter((x) => x.status === "pending")
      .reduce((s, x) => s + x.amountCents, 0);
    const activeAttendeeCount = pAtt.filter((a) => a.cancelledAt == null).length;
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      lifecycleStatus: p.lifecycleStatus,
      createdAt: p.createdAt,
      activeAttendeeCount,
      paidCents,
      outstandingCents,
      attendees: pAtt,
      payments: pPay,
    };
  });

  const aggregates = {
    registered: participantsOut.filter((p) => p.lifecycleStatus === "active").length,
    waitlisted: participantsOut.filter((p) => p.lifecycleStatus === "waitlisted").length,
    cancelled: participantsOut.filter((p) => p.lifecycleStatus === "cancelled").length,
    activeAttendees: participantsOut.reduce((s, p) => s + p.activeAttendeeCount, 0),
    succeededSumCents: payments
      .filter((x) => x.status === "succeeded")
      .reduce((s, x) => s + x.amountCents, 0),
    pendingSumCents: payments
      .filter((x) => x.status === "pending")
      .reduce((s, x) => s + x.amountCents, 0),
    refundedSumCents: payments
      .filter((x) => x.status === "refunded")
      .reduce((s, x) => s + x.amountCents, 0),
  };

  const participantById = new Map(participants.map((p) => [p.id, p]));
  const paymentsOut = payments.map((pay) => {
    const p = participantById.get(pay.participantId);
    return {
      ...pay,
      participantName: p ? `${p.firstName} ${p.lastName}`.trim() : pay.participantId,
      participantEmail: p?.email ?? "",
    };
  });

  return { event, organizer, aggregates, participants: participantsOut, payments: paymentsOut };
}

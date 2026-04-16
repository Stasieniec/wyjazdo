import { eq, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { countTakenSpots } from "@/lib/capacity";
import { derivedStatus } from "@/lib/participant-status";

export type OverviewStats = {
  activeEventCount: number;
  totalParticipants: number;
  totalRevenueCents: number;
  nearestEvent: {
    id: string;
    title: string;
    startsAt: number;
    taken: number;
    capacity: number;
  } | null;
};

export async function getOverviewStats(organizerId: string): Promise<OverviewStats> {
  const db = getDb();
  const now = Date.now();

  const events = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.organizerId, organizerId))
    .all();

  const activeEvents = events.filter((e) => e.status === "published");

  // Find nearest future event
  const futureEvents = events
    .filter((e) => e.startsAt > now && e.status !== "archived")
    .sort((a, b) => a.startsAt - b.startsAt);

  let nearestEvent: OverviewStats["nearestEvent"] = null;
  if (futureEvents.length > 0) {
    const ne = futureEvents[0];
    const taken = await countTakenSpots(ne.id, now);
    nearestEvent = {
      id: ne.id,
      title: ne.title,
      startsAt: ne.startsAt,
      taken,
      capacity: ne.capacity,
    };
  }

  // Count all active participants and revenue
  const eventIds = events.map((e) => e.id);
  let totalParticipants = 0;
  let totalRevenueCents = 0;

  if (eventIds.length > 0) {
    const participants = await db
      .select()
      .from(schema.participants)
      .where(inArray(schema.participants.eventId, eventIds))
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

    for (const p of participants) {
      const pPayments = paymentsByParticipant.get(p.id) ?? [];
      const ds = derivedStatus(p, pPayments, now);
      if (ds === "paid" || ds === "deposit_paid") {
        totalParticipants += 1;
        totalRevenueCents += pPayments
          .filter((pay) => pay.status === "succeeded")
          .reduce((sum, pay) => sum + pay.amountCents, 0);
      }
    }
  }

  return {
    activeEventCount: activeEvents.length,
    totalParticipants,
    totalRevenueCents,
    nearestEvent,
  };
}

export type AttentionItem = {
  eventId: string;
  eventTitle: string;
  type: "unpaid" | "waitlist" | "full";
  count: number;
  description: string;
};

export async function getAttentionItems(organizerId: string): Promise<AttentionItem[]> {
  const db = getDb();
  const now = Date.now();

  const events = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.organizerId, organizerId))
    .all();

  const items: AttentionItem[] = [];

  for (const event of events) {
    if (event.status === "archived") continue;

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

    let unpaidCount = 0;
    let waitlistCount = 0;
    let taken = 0;

    for (const p of participants) {
      const pPayments = paymentsByParticipant.get(p.id) ?? [];
      const ds = derivedStatus(p, pPayments, now);
      if (ds === "pending" || ds === "overdue") unpaidCount += 1;
      if (ds === "waitlisted") waitlistCount += 1;
      if (["pending", "deposit_paid", "paid", "overdue"].includes(ds)) taken += 1;
    }

    if (unpaidCount > 0) {
      items.push({
        eventId: event.id,
        eventTitle: event.title,
        type: "unpaid",
        count: unpaidCount,
        description: `${unpaidCount} ${unpaidCount === 1 ? "nieopłacony zapis" : "nieopłacone zapisy"}`,
      });
    }

    if (waitlistCount > 0) {
      items.push({
        eventId: event.id,
        eventTitle: event.title,
        type: "waitlist",
        count: waitlistCount,
        description: `${waitlistCount} ${waitlistCount === 1 ? "osoba" : "osoby"} na liście rezerwowej`,
      });
    }

    if (event.capacity > 0 && taken >= event.capacity && unpaidCount === 0 && waitlistCount === 0) {
      items.push({
        eventId: event.id,
        eventTitle: event.title,
        type: "full",
        count: taken,
        description: "wypełnione!",
      });
    }
  }

  // Sort: unpaid first, then waitlist, then full
  const order = { unpaid: 0, waitlist: 1, full: 2 };
  return items.sort((a, b) => order[a.type] - order[b.type]);
}

export type RecentActivity = {
  participantId: string;
  firstName: string;
  lastName: string;
  eventTitle: string;
  eventId: string;
  type: "signup" | "payment" | "cancellation";
  timestamp: number;
};

export async function getRecentActivity(
  organizerId: string,
  limit = 5,
): Promise<RecentActivity[]> {
  const db = getDb();

  // Get recent participants (signups) for this organizer's events
  const rows = await db
    .select({
      participantId: schema.participants.id,
      firstName: schema.participants.firstName,
      lastName: schema.participants.lastName,
      lifecycleStatus: schema.participants.lifecycleStatus,
      createdAt: schema.participants.createdAt,
      eventId: schema.events.id,
      eventTitle: schema.events.title,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .where(eq(schema.events.organizerId, organizerId))
    .orderBy(desc(schema.participants.createdAt))
    .limit(limit * 2) // Fetch extra to have room after filtering
    .all();

  const activities: RecentActivity[] = rows.map((r) => ({
    participantId: r.participantId,
    firstName: r.firstName,
    lastName: r.lastName,
    eventTitle: r.eventTitle,
    eventId: r.eventId,
    type: r.lifecycleStatus === "cancelled" ? "cancellation" : "signup",
    timestamp: r.createdAt,
  }));

  return activities.slice(0, limit);
}

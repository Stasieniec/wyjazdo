import { eq, isNull, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  derivedStatus,
  type DerivedStatus,
  type ParticipantLike,
  type PaymentLike,
} from "@/lib/participant-status";

const TAKEN: DerivedStatus[] = ["pending", "deposit_paid", "paid", "overdue"];

export type SpotsInput = {
  participant: ParticipantLike;
  payments: PaymentLike[];
  /** Number of non-cancelled attendees in this registration. 0 means "legacy" — counts as 1. */
  activeAttendees: number;
};

export function computeSpotsTaken(rows: SpotsInput[], nowMs: number): number {
  let taken = 0;
  for (const r of rows) {
    if (!TAKEN.includes(derivedStatus(r.participant, r.payments, nowMs))) continue;
    // Legacy registrations (no attendees row) still count as 1 spot (the registrant).
    taken += r.activeAttendees > 0 ? r.activeAttendees : 1;
  }
  return taken;
}

export async function countTakenSpots(eventId: string, nowMs: number): Promise<number> {
  const db = getDb();

  const participantRows = await db
    .select({ id: schema.participants.id, lifecycleStatus: schema.participants.lifecycleStatus })
    .from(schema.participants)
    .where(eq(schema.participants.eventId, eventId));
  if (participantRows.length === 0) return 0;

  const paymentRows = await db
    .select({
      participantId: schema.payments.participantId,
      kind: schema.payments.kind,
      status: schema.payments.status,
      dueAt: schema.payments.dueAt,
    })
    .from(schema.payments)
    .innerJoin(schema.participants, eq(schema.payments.participantId, schema.participants.id))
    .where(eq(schema.participants.eventId, eventId));

  const attendeeRows = await db
    .select({ participantId: schema.attendees.participantId })
    .from(schema.attendees)
    .innerJoin(schema.participants, eq(schema.attendees.participantId, schema.participants.id))
    .where(and(eq(schema.participants.eventId, eventId), isNull(schema.attendees.cancelledAt)));

  const paymentsByParticipant = new Map<string, PaymentLike[]>();
  for (const pr of paymentRows) {
    const list = paymentsByParticipant.get(pr.participantId) ?? [];
    list.push({
      kind: pr.kind as PaymentLike["kind"],
      status: pr.status as PaymentLike["status"],
      dueAt: pr.dueAt,
    });
    paymentsByParticipant.set(pr.participantId, list);
  }

  const attendeeCountByParticipant = new Map<string, number>();
  for (const a of attendeeRows) {
    attendeeCountByParticipant.set(a.participantId, (attendeeCountByParticipant.get(a.participantId) ?? 0) + 1);
  }

  const rows: SpotsInput[] = participantRows.map((p) => ({
    participant: { lifecycleStatus: p.lifecycleStatus as ParticipantLike["lifecycleStatus"] },
    payments: paymentsByParticipant.get(p.id) ?? [],
    activeAttendees: attendeeCountByParticipant.get(p.id) ?? 0,
  }));
  return computeSpotsTaken(rows, nowMs);
}

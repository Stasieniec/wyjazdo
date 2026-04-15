import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  derivedStatus,
  type DerivedStatus,
  type ParticipantLike,
  type PaymentLike,
} from "@/lib/participant-status";

const TAKEN: DerivedStatus[] = ["pending", "deposit_paid", "paid", "overdue"];

export function computeSpotsTaken(
  rows: { participant: ParticipantLike; payments: PaymentLike[] }[],
  nowMs: number,
): number {
  return rows.filter((r) => TAKEN.includes(derivedStatus(r.participant, r.payments, nowMs))).length;
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

  const byParticipant = new Map<string, PaymentLike[]>();
  for (const pr of paymentRows) {
    const list = byParticipant.get(pr.participantId) ?? [];
    list.push({
      kind: pr.kind as PaymentLike["kind"],
      status: pr.status as PaymentLike["status"],
      dueAt: pr.dueAt,
    });
    byParticipant.set(pr.participantId, list);
  }

  const rows = participantRows.map((p) => ({
    participant: { lifecycleStatus: p.lifecycleStatus as ParticipantLike["lifecycleStatus"] },
    payments: byParticipant.get(p.id) ?? [],
  }));
  return computeSpotsTaken(rows, nowMs);
}

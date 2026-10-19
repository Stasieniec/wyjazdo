import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { holdsPlace, type ParticipantLike, type PaymentLike } from "@/lib/participant-status";

export type SpotsInput = {
  participant: ParticipantLike;
  payments: PaymentLike[];
  /** Number of non-cancelled attendees in this registration. 0 means "legacy" — counts as 1. */
  activeAttendees: number;
};

/** Seats one registration takes: its active attendees, or 1 for legacy rows. */
export function seatsFor(activeAttendees: number): number {
  return activeAttendees > 0 ? activeAttendees : 1;
}

export function computeSpotsTaken(rows: SpotsInput[], nowMs: number): number {
  let taken = 0;
  for (const r of rows) {
    if (!holdsPlace(r.participant, r.payments, nowMs)) continue;
    taken += seatsFor(r.activeAttendees);
  }
  return taken;
}

/** SQL expression: active (non-cancelled) attendee seats of participant `pa`, at least 1. */
export const participantSeatsSql: SQL = sql`MAX(1, (SELECT COUNT(*) FROM attendees a
  WHERE a.participant_id = pa.id AND a.cancelled_at IS NULL))`;

/**
 * SQL condition: participant `pa` holds a place. Same rule as holdsPlace() in
 * participant-status.ts.
 */
export function holdsPlaceSql(nowMs: number): SQL {
  return sql`(pa.lifecycle_status = 'active'
    AND NOT EXISTS (SELECT 1 FROM payments py
      WHERE py.participant_id = pa.id AND py.status = 'refunded')
    AND EXISTS (SELECT 1 FROM payments py
      WHERE py.participant_id = pa.id
        AND (py.status = 'succeeded'
          OR (py.status = 'pending' AND (py.expires_at IS NULL OR py.expires_at > ${nowMs})))))`;
}

/**
 * SQL scalar: seats taken for an event. Used both by the public counter and
 * inside the conditional inserts/updates that admit a registration, so the
 * page and the admission check can never disagree.
 */
export function takenSeatsSql(eventId: string, nowMs: number): SQL {
  return sql`(SELECT COALESCE(SUM(${participantSeatsSql}), 0) FROM participants pa
    WHERE pa.event_id = ${eventId} AND ${holdsPlaceSql(nowMs)})`;
}

export async function countTakenSpots(eventId: string, nowMs: number): Promise<number> {
  const db = getDb();
  const rows = await db.all<{ taken: number }>(sql`SELECT ${takenSeatsSql(eventId, nowMs)} AS taken`);
  return Number(rows[0]?.taken ?? 0);
}

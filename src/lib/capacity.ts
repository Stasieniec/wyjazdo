import { and, eq, or, gt, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export type CountableParticipant = {
  status: "pending" | "paid" | "cancelled" | "refunded" | "waitlisted";
  expiresAt: number | null;
};

export function computeSpotsTaken(participants: CountableParticipant[], nowMs: number): number {
  return participants.filter(
    (p) =>
      p.status === "paid" ||
      (p.status === "pending" && p.expiresAt !== null && p.expiresAt > nowMs),
  ).length;
}

export async function countTakenSpots(eventId: string, nowMs: number): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.participants)
    .where(
      and(
        eq(schema.participants.eventId, eventId),
        or(
          eq(schema.participants.status, "paid"),
          and(
            eq(schema.participants.status, "pending"),
            gt(schema.participants.expiresAt, nowMs),
          ),
        ),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}

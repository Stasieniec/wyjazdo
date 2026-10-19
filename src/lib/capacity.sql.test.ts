import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => import("@/test/db-mock").then((m) => m.dbClientMock()));

import { resetTestDb, testDb } from "@/test/db-mock";
import { seedEvent, seedOrganizer, seedRegistration, DAY } from "@/test/fixtures";
import { countTakenSpots, computeSpotsTaken } from "./capacity";
import { listPaymentsForParticipant } from "@/lib/db/queries/payments";
import { listActiveAttendeesForParticipant } from "@/lib/db/queries/attendees";
import { listParticipantsForEvent } from "@/lib/db/queries/participants";

const NOW = Date.now();

async function jsCount(eventId: string, now: number) {
  const parts = await listParticipantsForEvent(eventId);
  const rows = await Promise.all(
    parts.map(async (p) => ({
      participant: p,
      payments: await listPaymentsForParticipant(p.id),
      activeAttendees: (await listActiveAttendeesForParticipant(p.id)).length,
    })),
  );
  return computeSpotsTaken(rows, now);
}

describe("capacity rule (SQL and JS agree)", () => {
  beforeEach(() => resetTestDb());

  it("an abandoned checkout stops holding a place once it expires", async () => {
    const { db } = testDb();
    const org = await seedOrganizer(db);
    const ev = await seedEvent(db, org.id);
    // Pair whose checkout lapsed 1 minute ago, cron not run yet (still 'pending').
    await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "pending", expiresAt: NOW - 60_000 }] });
    // Pair whose checkout the cron already expired.
    await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "expired" }] });
    // Single whose card was declined for good.
    await seedRegistration(db, ev.id, { seats: 1, payments: [{ status: "failed" }] });

    expect(await countTakenSpots(ev.id, NOW)).toBe(0);
    expect(await jsCount(ev.id, NOW)).toBe(0);
  });

  it("counts every seat of live and paid registrations, and nothing else", async () => {
    const { db } = testDb();
    const org = await seedOrganizer(db);
    const ev = await seedEvent(db, org.id);
    await seedRegistration(db, ev.id, { seats: 2, payments: [{ status: "pending", expiresAt: NOW + 60_000 }] }); // 2
    await seedRegistration(db, ev.id, { seats: 1, payments: [{ status: "succeeded" }] }); // 1
    await seedRegistration(db, ev.id, {
      seats: 2,
      payments: [{ status: "succeeded" }, { kind: "balance", status: "expired", dueAt: NOW - DAY }],
    }); // 2 (overdue still holds)
    await seedRegistration(db, ev.id, { seats: 3, lifecycle: "waitlisted" }); // 0
    await seedRegistration(db, ev.id, { seats: 1, lifecycle: "cancelled", payments: [{ status: "succeeded" }] }); // 0
    await seedRegistration(db, ev.id, { seats: 1, payments: [{ status: "refunded" }] }); // 0
    await seedRegistration(db, ev.id, { seats: 1, payments: [{ status: "pending", expiresAt: null }] }); // 1
    // Legacy registration without attendee rows still takes one seat.
    await seedRegistration(db, ev.id, { seats: 0, payments: [{ status: "succeeded", kind: "full" }] }); // 1

    expect(await countTakenSpots(ev.id, NOW)).toBe(7);
    expect(await jsCount(ev.id, NOW)).toBe(7);
  });

  it("does not count cancelled attendees of a party", async () => {
    const { db, d1 } = testDb();
    const org = await seedOrganizer(db);
    const ev = await seedEvent(db, org.id);
    const r = await seedRegistration(db, ev.id, { seats: 3, payments: [{ status: "succeeded" }] });
    d1.sqlite.prepare("UPDATE attendees SET cancelled_at = 1 WHERE id = ?").run(r.attendees[0].id);
    expect(await countTakenSpots(ev.id, NOW)).toBe(2);
    expect(await jsCount(ev.id, NOW)).toBe(2);
  });
});

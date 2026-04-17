import { describe, it, expect } from "vitest";
import { computeSpotsTaken } from "./capacity";
import type { ParticipantLike, PaymentLike } from "./participant-status";

const NOW = 1_000_000_000_000;

const lc = (s: ParticipantLike["lifecycleStatus"]): ParticipantLike => ({ lifecycleStatus: s });
const pay = (over: Partial<PaymentLike> = {}): PaymentLike => ({
  kind: "full",
  status: "pending",
  dueAt: null,
  ...over,
});

describe("computeSpotsTaken", () => {
  it("counts legacy registrations (no attendees) as 1 spot each", () => {
    const rows = [
      { participant: lc("active"), payments: [pay({ status: "pending" })], activeAttendees: 0 },
      { participant: lc("active"), payments: [pay({ kind: "deposit", status: "succeeded" })], activeAttendees: 0 },
      { participant: lc("active"), payments: [pay({ kind: "full", status: "succeeded" })], activeAttendees: 0 },
      {
        participant: lc("active"),
        payments: [
          pay({ kind: "deposit", status: "succeeded" }),
          pay({ kind: "balance", status: "expired", dueAt: NOW - 1 }),
        ],
        activeAttendees: 0,
      },
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(4);
  });

  it("counts each active attendee toward capacity", () => {
    const rows = [
      { participant: lc("active"), payments: [pay({ status: "succeeded" })], activeAttendees: 3 },
      { participant: lc("active"), payments: [pay({ status: "pending" })], activeAttendees: 2 },
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(5);
  });

  it("does not count waitlisted, cancelled, refunded — even with attendees", () => {
    const rows = [
      { participant: lc("waitlisted"), payments: [], activeAttendees: 3 },
      { participant: lc("cancelled"), payments: [pay({ status: "succeeded" })], activeAttendees: 3 },
      { participant: lc("active"), payments: [pay({ status: "refunded" })], activeAttendees: 3 },
      { participant: lc("active"), payments: [pay({ status: "expired" })], activeAttendees: 3 },
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(0);
  });
});

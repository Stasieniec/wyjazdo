import { describe, it, expect } from "vitest";
import { computeSpotsTaken } from "./capacity";
import type { ParticipantLike, PaymentLike } from "./participant-status";

type Row = { participant: ParticipantLike; payments: PaymentLike[] };

const NOW = 1_000_000_000_000;

const lc = (s: ParticipantLike["lifecycleStatus"]): ParticipantLike => ({ lifecycleStatus: s });
const pay = (over: Partial<PaymentLike> = {}): PaymentLike => ({
  kind: "full",
  status: "pending",
  dueAt: null,
  ...over,
});

describe("computeSpotsTaken", () => {
  it("counts pending, deposit_paid, paid, and overdue", () => {
    const rows: Row[] = [
      { participant: lc("active"), payments: [pay({ status: "pending" })] },
      { participant: lc("active"), payments: [pay({ kind: "deposit", status: "succeeded" })] },
      { participant: lc("active"), payments: [pay({ kind: "full", status: "succeeded" })] },
      {
        participant: lc("active"),
        payments: [
          pay({ kind: "deposit", status: "succeeded" }),
          pay({ kind: "balance", status: "expired", dueAt: NOW - 1 }),
        ],
      },
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(4);
  });

  it("does not count waitlisted, cancelled, refunded", () => {
    const rows: Row[] = [
      { participant: lc("waitlisted"), payments: [] },
      { participant: lc("cancelled"), payments: [pay({ status: "succeeded" })] },
      { participant: lc("active"), payments: [pay({ status: "refunded" })] },
      { participant: lc("active"), payments: [pay({ status: "expired" })] },
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(0);
  });
});

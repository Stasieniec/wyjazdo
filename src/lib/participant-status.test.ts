import { describe, it, expect } from "vitest";
import { derivedStatus, type PaymentLike, type ParticipantLike } from "./participant-status";

const p = (over: Partial<PaymentLike> = {}): PaymentLike => ({
  kind: "full",
  status: "pending",
  dueAt: null,
  ...over,
});

const lc = (status: ParticipantLike["lifecycleStatus"]): ParticipantLike => ({
  lifecycleStatus: status,
});

const NOW = 1_000_000_000_000;

describe("derivedStatus", () => {
  it("returns waitlisted when lifecycle says so", () => {
    expect(derivedStatus(lc("waitlisted"), [], NOW)).toBe("waitlisted");
  });

  it("returns cancelled when lifecycle says so (even with succeeded payments)", () => {
    expect(derivedStatus(lc("cancelled"), [p({ status: "succeeded" })], NOW)).toBe("cancelled");
  });

  it("returns cancelled when active but zero payments", () => {
    expect(derivedStatus(lc("active"), [], NOW)).toBe("cancelled");
  });

  it("returns cancelled when all payments expired or failed", () => {
    expect(derivedStatus(lc("active"), [p({ status: "expired" }), p({ status: "failed" })], NOW)).toBe("cancelled");
  });

  it("returns pending when any payment is pending", () => {
    expect(derivedStatus(lc("active"), [p({ status: "pending" })], NOW)).toBe("pending");
  });

  it("returns paid when a full payment succeeded", () => {
    expect(derivedStatus(lc("active"), [p({ kind: "full", status: "succeeded" })], NOW)).toBe("paid");
  });

  it("returns paid when both deposit and balance succeeded", () => {
    const ps = [p({ kind: "deposit", status: "succeeded" }), p({ kind: "balance", status: "succeeded" })];
    expect(derivedStatus(lc("active"), ps, NOW)).toBe("paid");
  });

  it("returns deposit_paid when only deposit succeeded and no balance row", () => {
    expect(derivedStatus(lc("active"), [p({ kind: "deposit", status: "succeeded" })], NOW)).toBe("deposit_paid");
  });

  it("returns deposit_paid when deposit succeeded and balance is pending", () => {
    const ps = [p({ kind: "deposit", status: "succeeded" }), p({ kind: "balance", status: "pending" })];
    expect(derivedStatus(lc("active"), ps, NOW)).toBe("deposit_paid");
  });

  it("returns overdue when deposit succeeded and balance expired past its due date", () => {
    const ps = [
      p({ kind: "deposit", status: "succeeded" }),
      p({ kind: "balance", status: "expired", dueAt: NOW - 1 }),
    ];
    expect(derivedStatus(lc("active"), ps, NOW)).toBe("overdue");
  });

  it("stays deposit_paid when balance expired but due date still future", () => {
    const ps = [
      p({ kind: "deposit", status: "succeeded" }),
      p({ kind: "balance", status: "expired", dueAt: NOW + 86_400_000 }),
    ];
    expect(derivedStatus(lc("active"), ps, NOW)).toBe("deposit_paid");
  });

  it("returns refunded whenever any payment is refunded", () => {
    expect(derivedStatus(lc("active"), [p({ kind: "full", status: "refunded" })], NOW)).toBe("refunded");
  });
});

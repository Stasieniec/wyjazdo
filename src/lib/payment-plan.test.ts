import { describe, it, expect } from "vitest";
import { planFirstPayment, balanceOwedCents, isChargeableOrFree, PaymentRuleError } from "./payment-plan";

const NOW = Date.UTC(2026, 9, 19);
const DAY = 86_400_000;

describe("planFirstPayment", () => {
  const base = { totalCents: 296_000, depositPerPersonCents: 50_000, attendeeCount: 2, nowMs: NOW };

  it("charges the deposit per person while the balance due date is ahead", () => {
    expect(planFirstPayment({ ...base, balanceDueAt: NOW + 10 * DAY })).toEqual({ kind: "deposit", amountCents: 100_000 });
  });

  it("charges the full amount once the balance due date has passed", () => {
    expect(planFirstPayment({ ...base, balanceDueAt: NOW - 1 })).toEqual({ kind: "full", amountCents: 296_000 });
  });

  it("charges in full when the remaining balance would be below 2 zł", () => {
    expect(
      planFirstPayment({ totalCents: 50_100, depositPerPersonCents: 50_000, attendeeCount: 1, balanceDueAt: null, nowMs: NOW }),
    ).toEqual({ kind: "full", amountCents: 50_100 });
  });

  it("charges in full when the deposit itself would be below 2 zł", () => {
    expect(
      planFirstPayment({ totalCents: 148_000, depositPerPersonCents: 100, attendeeCount: 1, balanceDueAt: null, nowMs: NOW }),
    ).toEqual({ kind: "full", amountCents: 148_000 });
  });

  it("is free for a zero total and refuses a total between 0 and 2 zł", () => {
    expect(planFirstPayment({ ...base, totalCents: 0, balanceDueAt: null })).toEqual({ kind: "free", amountCents: 0 });
    expect(() => planFirstPayment({ ...base, totalCents: 150, balanceDueAt: null })).toThrow(PaymentRuleError);
  });
});

describe("balanceOwedCents", () => {
  it("is total minus what was paid, never negative", () => {
    expect(balanceOwedCents(296_000, 100_000)).toBe(196_000);
    expect(balanceOwedCents(148_000, 200_000)).toBe(0);
  });
});

describe("isChargeableOrFree", () => {
  it("accepts 0 and amounts from 2 zł", () => {
    expect(isChargeableOrFree(0)).toBe(true);
    expect(isChargeableOrFree(199)).toBe(false);
    expect(isChargeableOrFree(200)).toBe(true);
  });
});

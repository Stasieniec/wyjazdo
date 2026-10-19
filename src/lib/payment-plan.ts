/**
 * Business rules for how much a registration is charged and when. Provider
 * independent: amounts are in grosze, nothing here knows about Stripe beyond
 * the minimum charge, which most card processors have in some form.
 */

/** Stripe refuses PLN charges below 2.00 zł. */
export const MIN_CHARGE_CENTS = 200;

export class PaymentRuleError extends Error {}

export type FirstPaymentPlan =
  | { kind: "free"; amountCents: 0 }
  | { kind: "full" | "deposit"; amountCents: number };

/**
 * What to charge at registration (or when a waitlisted guest is promoted).
 *
 * - Deposit only while the balance due date is still in the future. After it,
 *   the reminder windows are gone, so the full amount is charged up front.
 * - If the deposit or the remaining balance would fall below the minimum
 *   charge, charge in full instead (a balance below the minimum could never
 *   be collected).
 * - A total between 0 and the minimum cannot be charged at all.
 */
export function planFirstPayment(params: {
  totalCents: number;
  depositPerPersonCents: number | null;
  attendeeCount: number;
  balanceDueAt: number | null;
  nowMs: number;
}): FirstPaymentPlan {
  const { totalCents, attendeeCount, balanceDueAt, nowMs } = params;
  if (totalCents <= 0) return { kind: "free", amountCents: 0 };
  if (totalCents < MIN_CHARGE_CENTS) {
    throw new PaymentRuleError("total below minimum charge");
  }
  const deposit = Math.min((params.depositPerPersonCents ?? 0) * attendeeCount, totalCents);
  const balance = totalCents - deposit;
  const depositMode =
    deposit >= MIN_CHARGE_CENTS &&
    balance >= MIN_CHARGE_CENTS &&
    (balanceDueAt == null || balanceDueAt > nowMs);
  return depositMode
    ? { kind: "deposit", amountCents: deposit }
    : { kind: "full", amountCents: totalCents };
}

/**
 * Balance still owed: the registration total minus what was actually paid
 * (succeeded payments, net of partial refunds). Not derived from the current
 * deposit setting, so organizer edits cannot skew it.
 */
export function balanceOwedCents(totalCents: number, netPaidCents: number): number {
  return Math.max(0, totalCents - netPaidCents);
}

/** Validation helper for organizer-entered amounts: 0 (free) or at least the minimum. */
export function isChargeableOrFree(cents: number): boolean {
  return cents === 0 || cents >= MIN_CHARGE_CENTS;
}

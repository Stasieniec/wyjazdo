export type PaymentKind = "full" | "deposit" | "balance";
export type PaymentStatus = "pending" | "succeeded" | "expired" | "failed" | "refunded";
export type LifecycleStatus = "active" | "waitlisted" | "cancelled";

export type DerivedStatus =
  | "pending"
  | "paid"
  | "deposit_paid"
  | "overdue"
  | "refunded"
  | "cancelled"
  | "waitlisted";

export type PaymentLike = {
  kind: PaymentKind;
  status: PaymentStatus;
  dueAt: number | null;
  /** When a pending payment stops being payable. Missing/null means no limit. */
  expiresAt?: number | null;
  /** Cumulative refunded amount; only meaningful with amountCents. */
  refundedAmountCents?: number | null;
  amountCents?: number;
  updatedAt?: number;
  createdAt?: number;
};

export type ParticipantLike = {
  lifecycleStatus: LifecycleStatus;
};

/**
 * A pending payment holds a place only while its checkout can still be paid.
 * Once expiresAt has passed it counts as expired even if the cleanup cron has
 * not flipped the row yet.
 */
export function isLivePending(p: PaymentLike, nowMs: number): boolean {
  return p.status === "pending" && (p.expiresAt == null || p.expiresAt > nowMs);
}

/**
 * The place-holding rule. An active participant holds a place when they have
 * a succeeded payment or a payment that can still be paid, and nothing was
 * fully refunded. A participant whose first payment expired or failed stops
 * holding a place without any status change.
 *
 * The SQL in capacity.ts (takenSeatsSql) implements the same rule; the tests
 * in capacity.test.ts check both agree.
 */
export function holdsPlace(
  participant: ParticipantLike,
  payments: PaymentLike[],
  nowMs: number,
): boolean {
  if (participant.lifecycleStatus !== "active") return false;
  if (payments.some((p) => p.status === "refunded")) return false;
  return payments.some((p) => p.status === "succeeded" || isLivePending(p, nowMs));
}

/**
 * There should be at most one live balance row per participant, but older
 * data can have several. Readers pick: pending first, then succeeded, then
 * the most recently touched one.
 */
export function currentBalancePayment<T extends PaymentLike>(payments: T[]): T | undefined {
  const balances = payments.filter((p) => p.kind === "balance");
  if (balances.length <= 1) return balances[0];
  const rank = (p: T) => (p.status === "pending" ? 0 : p.status === "succeeded" ? 1 : 2);
  return [...balances].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
  )[0];
}

/** Money actually kept from a payment: succeeded amount minus partial refunds. */
export function netPaidCents(p: PaymentLike): number {
  if (p.status !== "succeeded") return 0;
  return Math.max(0, (p.amountCents ?? 0) - (p.refundedAmountCents ?? 0));
}

/** Money returned to the payer on this payment. */
export function refundedCents(p: PaymentLike): number {
  if (p.status === "refunded") return p.amountCents ?? 0;
  return p.refundedAmountCents ?? 0;
}

export function totalNetPaidCents(payments: PaymentLike[]): number {
  return payments.reduce((sum, p) => sum + netPaidCents(p), 0);
}

export function derivedStatus(
  participant: ParticipantLike,
  payments: PaymentLike[],
  nowMs: number,
): DerivedStatus {
  if (participant.lifecycleStatus === "waitlisted") return "waitlisted";
  if (participant.lifecycleStatus === "cancelled") return "cancelled";

  if (payments.some((p) => p.status === "refunded")) return "refunded";

  const succeeded = payments.filter((p) => p.status === "succeeded");
  const hasFullSucceeded = succeeded.some((p) => p.kind === "full");
  const hasDepositSucceeded = succeeded.some((p) => p.kind === "deposit");
  const hasBalanceSucceeded = succeeded.some((p) => p.kind === "balance");

  if (hasFullSucceeded) return "paid";
  if (hasDepositSucceeded && hasBalanceSucceeded) return "paid";

  if (hasDepositSucceeded) {
    const balance = currentBalancePayment(payments);
    if (!balance) return "deposit_paid";
    if (balance.status === "pending") return "deposit_paid";
    // balance is expired or failed
    if (balance.dueAt !== null && balance.dueAt <= nowMs) return "overdue";
    return "deposit_paid";
  }

  if (payments.some((p) => isLivePending(p, nowMs))) return "pending";

  return "cancelled";
}

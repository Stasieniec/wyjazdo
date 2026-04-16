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
};

export type ParticipantLike = {
  lifecycleStatus: LifecycleStatus;
};

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
    const balance = payments.find((p) => p.kind === "balance");
    if (!balance) return "deposit_paid";
    if (balance.status === "pending") return "deposit_paid";
    // balance is expired or failed
    if (balance.dueAt !== null && balance.dueAt <= nowMs) return "overdue";
    return "deposit_paid";
  }

  if (payments.some((p) => p.status === "pending")) return "pending";

  return "cancelled";
}

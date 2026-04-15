export type ParticipantFilterStatus = "all" | "paid" | "deposit_paid" | "overdue" | "pending" | "cancelled";

export function parseParticipantFilterStatus(
  status: string | undefined,
): ParticipantFilterStatus {
  if (
    status === "paid" ||
    status === "deposit_paid" ||
    status === "overdue" ||
    status === "pending" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "all";
}

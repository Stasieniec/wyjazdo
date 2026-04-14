export type ParticipantFilterStatus = "all" | "paid" | "pending" | "cancelled";

export function parseParticipantFilterStatus(
  status: string | undefined,
): ParticipantFilterStatus {
  if (status === "paid" || status === "pending" || status === "cancelled") {
    return status;
  }
  return "all";
}

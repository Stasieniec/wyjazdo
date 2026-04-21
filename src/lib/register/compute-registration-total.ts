import { computeRegistrationAmountsCents } from "./compute-registration-amounts";

/**
 * Compute the authoritative registration total (in cents) for a participant
 * based on their active attendee rows and the event's attendeeTypes config.
 *
 * Falls back to `event.priceCents` when the event is in legacy mode
 * (`attendeeTypes` is null) or when the participant has no active attendee
 * rows (also legacy).
 */
export async function computeRegistrationTotalCents(
  participantId: string,
  event: { attendeeTypes: string | null; priceCents: number },
): Promise<number> {
  const { totalCents } = await computeRegistrationAmountsCents(participantId, {
    ...event,
    depositCents: 0,
  });
  return totalCents;
}

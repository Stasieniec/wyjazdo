import type { AttendeeType } from "@/lib/validators/attendee-types";
import { calculateTotal } from "@/lib/pricing";
import { listActiveAttendeesForParticipant } from "@/lib/db/queries/attendees";

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
  if (!event.attendeeTypes) return event.priceCents;
  let types: AttendeeType[];
  try {
    types = JSON.parse(event.attendeeTypes) as AttendeeType[];
  } catch {
    return event.priceCents;
  }
  const attendees = await listActiveAttendeesForParticipant(participantId);
  if (attendees.length === 0) return event.priceCents;
  const quantities: Record<string, number> = {};
  for (const a of attendees) {
    quantities[a.attendeeTypeId] = (quantities[a.attendeeTypeId] ?? 0) + 1;
  }
  return calculateTotal(types, quantities).total;
}

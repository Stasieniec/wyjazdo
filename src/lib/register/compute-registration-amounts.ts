import type { AttendeeType } from "@/lib/validators/attendee-types";
import { calculateTotal } from "@/lib/pricing";
import { listActiveAttendeesForParticipant } from "@/lib/db/queries/attendees";

export type RegistrationAmounts = {
  totalCents: number;
  effectiveDepositCents: number;
  attendeeCount: number;
  depositMode: boolean;
};

type EventLike = {
  attendeeTypes: string | null;
  priceCents: number;
  depositCents: number | null;
};

function parseTypes(raw: string | null): AttendeeType[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AttendeeType[];
  } catch {
    return null;
  }
}

function fromAttendeeCountAndTotal(
  totalCents: number,
  depositPerPerson: number,
  attendeeCount: number,
): RegistrationAmounts {
  const effectiveDepositCents = Math.min(depositPerPerson * attendeeCount, totalCents);
  const depositMode = effectiveDepositCents > 0 && effectiveDepositCents < totalCents;
  return { totalCents, effectiveDepositCents, attendeeCount, depositMode };
}

/**
 * Compute total + effective deposit + attendee count for a registered participant.
 * Reads active attendee rows; if none (legacy), treats as 1 attendee at event.priceCents.
 */
export async function computeRegistrationAmountsCents(
  participantId: string,
  event: EventLike,
): Promise<RegistrationAmounts> {
  const types = parseTypes(event.attendeeTypes);
  const attendees = await listActiveAttendeesForParticipant(participantId);
  const depositPerPerson = event.depositCents ?? 0;

  if (!types || attendees.length === 0) {
    return fromAttendeeCountAndTotal(event.priceCents, depositPerPerson, 1);
  }

  const quantities: Record<string, number> = {};
  for (const a of attendees) quantities[a.attendeeTypeId] = (quantities[a.attendeeTypeId] ?? 0) + 1;
  const totalCents = calculateTotal(types, quantities).total;
  return fromAttendeeCountAndTotal(totalCents, depositPerPerson, attendees.length);
}

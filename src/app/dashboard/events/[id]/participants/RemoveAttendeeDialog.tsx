"use client";
import type { Attendee } from "@/lib/db/schema";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { calculateTotal } from "@/lib/pricing";
import { pluralOsoby } from "@/lib/plural";
import { formatPlnFromCents } from "@/lib/format-currency";

type Props = {
  registrantName: string;
  attendeeToRemove: Attendee & { typeName: string };
  remainingAttendees: Array<Attendee & { typeName: string }>;
  attendeeTypes: AttendeeType[];
  paidCents: number;
  remainingCapacity: number;
  onConfirm: () => void;
  onCancel: () => void;
};

function quantitiesFrom(list: Array<Attendee>): Record<string, number> {
  const q: Record<string, number> = {};
  for (const a of list) q[a.attendeeTypeId] = (q[a.attendeeTypeId] ?? 0) + 1;
  return q;
}

export function RemoveAttendeeDialog({
  registrantName, attendeeToRemove, remainingAttendees, attendeeTypes,
  paidCents, remainingCapacity, onConfirm, onCancel,
}: Props) {
  const originalTotal = calculateTotal(
    attendeeTypes,
    quantitiesFrom([attendeeToRemove, ...remainingAttendees]),
  ).total;
  const newTotal = calculateTotal(attendeeTypes, quantitiesFrom(remainingAttendees)).total;
  const suggestedRefund = Math.max(0, Math.min(paidCents, originalTotal - newTotal));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-md max-w-md w-full p-6 space-y-3">
        <h2 className="font-semibold text-lg">
          Usunąć {attendeeToRemove.firstName} {attendeeToRemove.lastName} z zgłoszenia?
        </h2>
        <p className="text-sm">
          {attendeeToRemove.firstName} jest częścią zgłoszenia <strong>{registrantName}</strong>
          {" "}({remainingAttendees.length + 1} {pluralOsoby(remainingAttendees.length + 1)} łącznie). Po usunięciu:
        </p>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Zgłoszenie będzie zawierać {remainingAttendees.length} {pluralOsoby(remainingAttendees.length)}.</li>
          <li>Nowa cena: <strong>{formatPlnFromCents(newTotal)}</strong> (było {formatPlnFromCents(originalTotal)})</li>
          <li>Sugerowany zwrot: <strong>{formatPlnFromCents(suggestedRefund)}</strong></li>
          <li>Zwolni się 1 miejsce (pozostałych wolnych: {remainingCapacity + 1})</li>
        </ul>
        <p className="text-xs text-gray-600">
          Zwrot nie zostanie wykonany automatycznie — wykonasz go ręcznie po potwierdzeniu.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="px-3 py-1 border rounded" onClick={onCancel}>Anuluj</button>
          <button type="button" className="px-3 py-1 bg-red-600 text-white rounded" onClick={onConfirm}>
            Usuń uczestnika
          </button>
        </div>
      </div>
    </div>
  );
}

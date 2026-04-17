"use client";
import type { Attendee } from "@/lib/db/schema";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { calculateTotal } from "@/lib/pricing";

type AttendeeWithTypeName = Attendee & { typeName: string };

type Props = {
  registrantName: string;
  activeAttendees: AttendeeWithTypeName[]; // empty for legacy
  attendeeTypes: AttendeeType[];
  legacyPriceCents: number; // event.priceCents — used when activeAttendees is empty
  paidCents: number;
  onConfirm: () => void;
  onCancel: () => void;
};

function formatPLN(cents: number) {
  return (cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł";
}

function quantitiesFrom(list: Array<Attendee>): Record<string, number> {
  const q: Record<string, number> = {};
  for (const a of list) q[a.attendeeTypeId] = (q[a.attendeeTypeId] ?? 0) + 1;
  return q;
}

export function CancelRegistrationDialog({
  registrantName, activeAttendees, attendeeTypes, legacyPriceCents, paidCents, onConfirm, onCancel,
}: Props) {
  const isGroup = activeAttendees.length > 1;
  const originalTotal = activeAttendees.length > 0
    ? calculateTotal(attendeeTypes, quantitiesFrom(activeAttendees)).total
    : legacyPriceCents;
  const suggestedRefund = Math.max(0, Math.min(paidCents, originalTotal));
  const spotsFreed = Math.max(1, activeAttendees.length);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-md max-w-md w-full p-6 space-y-3">
        <h2 className="font-semibold text-lg">
          Anulować zgłoszenie {registrantName}?
        </h2>
        {isGroup ? (
          <>
            <p className="text-sm">To usunie wszystkie {activeAttendees.length} osób z wydarzenia:</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              {activeAttendees.map((a) => (
                <li key={a.id}>
                  {a.firstName} {a.lastName} ({a.typeName})
                </li>
              ))}
            </ul>
            <p className="text-sm">Zwolni się {spotsFreed} miejsc. Sugerowany zwrot: <strong>{formatPLN(suggestedRefund)}</strong>.</p>
          </>
        ) : (
          <p className="text-sm">Sugerowany zwrot: <strong>{formatPLN(suggestedRefund)}</strong>.</p>
        )}
        <p className="text-xs text-gray-600">
          Zwrot nie zostanie wykonany automatycznie.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="px-3 py-1 border rounded" onClick={onCancel}>Anuluj</button>
          <button type="button" className="px-3 py-1 bg-red-600 text-white rounded" onClick={onConfirm}>
            Anuluj zgłoszenie
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import type { Attendee } from "@/lib/db/schema";

type Registrant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  derivedStatus: string;
  totalCents: number;
};

type AttendeeWithTypeName = Attendee & { typeName: string };

type Props = {
  registrant: Registrant;
  attendees: AttendeeWithTypeName[];
  onRemoveAttendee?: (attendeeId: string) => void;
  onCancelRegistration?: () => void;
};

function formatPLN(cents: number): string {
  return (cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł";
}

export function AttendeeGroupRow({ registrant, attendees, onRemoveAttendee, onCancelRegistration }: Props) {
  const [open, setOpen] = useState(attendees.length === 1);
  const activeAttendees = attendees.filter((a) => a.cancelledAt == null);
  const hasMultiple = activeAttendees.length > 1;

  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 text-left">
          <span className="font-semibold">{registrant.lastName} {registrant.firstName}</span>
          <span className="text-gray-500 ml-2">({registrant.email})</span>
          {hasMultiple && <span className="ml-2 text-xs bg-gray-200 rounded px-2">{activeAttendees.length} osób</span>}
        </button>
        <div className="text-sm text-gray-700">{formatPLN(registrant.totalCents)}</div>
        <div className="ml-3 text-sm">{registrant.derivedStatus}</div>
        {onCancelRegistration && (
          <button type="button" className="ml-3 text-sm text-red-600 underline" onClick={onCancelRegistration}>
            Anuluj zgłoszenie
          </button>
        )}
      </div>
      {open && (
        <ul className="border-t divide-y">
          {activeAttendees.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{a.firstName} {a.lastName}</span>
                <span className="ml-2 text-gray-500">{a.typeName}</span>
              </div>
              {hasMultiple && onRemoveAttendee && (
                <button type="button" className="text-xs text-red-600 underline"
                  onClick={() => onRemoveAttendee(a.id)}>
                  Usuń uczestnika
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

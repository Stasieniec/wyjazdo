"use client";

import { useActionState } from "react";
import { AttendeeTypesField } from "../attendee-types-field";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { saveSectionAttendeesAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initialAttendeeTypes: AttendeeType[] | null };

export function SectionAttendees({ eventId, initialAttendeeTypes }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    saveSectionAttendeesAction.bind(null, eventId),
    null,
  );
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell
      id="uczestnicy"
      title="Uczestnicy i ceny"
      description="Pytania o uczestnikach edytujesz w sekcji Pytania."
      action={action}
      state={state}
    >
      {errors.attendeeTypes && (
        <p className="text-sm text-destructive">{errors.attendeeTypes}</p>
      )}
      <AttendeeTypesField
        initialAttendeeTypes={initialAttendeeTypes}
        showCustomFieldsEditor={false}
      />
    </SectionShell>
  );
}

"use client";

import { useActionState } from "react";
import { EventDateTimeFields } from "@/components/dashboard/EventDateTimeFields";
import { saveSectionDatesAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initial: { startsAt: number; endsAt: number } };

export function SectionDates({ eventId, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    saveSectionDatesAction.bind(null, eventId),
    null,
  );
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell id="termin" title="Termin" action={action} state={state}>
      <EventDateTimeFields
        defaultStartsAt={initial.startsAt}
        defaultEndsAt={initial.endsAt}
        error={errors.startsAt ?? errors.endsAt}
      />
    </SectionShell>
  );
}

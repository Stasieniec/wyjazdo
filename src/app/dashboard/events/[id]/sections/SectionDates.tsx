"use client";

import { useActionState } from "react";
import { EventDateTimeFields } from "@/components/dashboard/EventDateTimeFields";
import { saveSectionDatesAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";
import { withIsoDateTimes } from "@/lib/datetime-form";

type Props = { eventId: string; initial: { startsAt: number; endsAt: number } };

export function SectionDates({ eventId, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    (prev, fd) => saveSectionDatesAction(eventId, prev, withIsoDateTimes(fd, ["startsAt", "endsAt"])),
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

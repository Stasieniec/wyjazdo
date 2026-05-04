"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui";
import { saveSectionCapacityAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initial: { capacity: number } };

export function SectionCapacity({ eventId, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    saveSectionCapacityAction.bind(null, eventId),
    null,
  );
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell
      id="miejsca"
      title="Liczba miejsc"
      description="Liczy się każda osoba w zgłoszeniu — także dzieci i osoby zapisane razem (np. w grupie)."
      action={action}
      state={state}
    >
      <Input
        name="capacity"
        type="number"
        label="Liczba miejsc"
        min={1}
        max={10000}
        required
        defaultValue={initial.capacity}
        error={errors.capacity}
      />
    </SectionShell>
  );
}

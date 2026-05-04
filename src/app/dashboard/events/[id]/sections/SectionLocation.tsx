"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui";
import { saveSectionLocationAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initial: { location: string } };

export function SectionLocation({ eventId, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    saveSectionLocationAction.bind(null, eventId),
    null,
  );
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell id="miejsce" title="Miejsce" action={action} state={state}>
      <Input
        name="location"
        label="Adres / miejsce"
        defaultValue={initial.location}
        maxLength={200}
        error={errors.location}
      />
    </SectionShell>
  );
}

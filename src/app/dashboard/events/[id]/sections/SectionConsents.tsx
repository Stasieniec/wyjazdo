"use client";

import { useActionState, useState } from "react";
import EventConsentsEditor from "@/components/dashboard/EventConsentsEditor";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import { saveSectionConsentsAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initial: ConsentConfigItem[] };

export function SectionConsents({ eventId, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    saveSectionConsentsAction.bind(null, eventId),
    null,
  );
  const [consents, setConsents] = useState<ConsentConfigItem[]>(initial);
  return (
    <SectionShell
      id="zgody"
      title="Zgody i regulaminy"
      description="Zgody platformy są obowiązkowe i wyświetlane automatycznie. Możesz dodać własne."
      action={action}
      state={state}
    >
      <EventConsentsEditor initial={consents} name="consentConfig" onChange={setConsents} />
    </SectionShell>
  );
}

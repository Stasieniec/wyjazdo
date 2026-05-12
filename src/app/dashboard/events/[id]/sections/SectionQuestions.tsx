"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui";
import CustomQuestionsEditor from "@/components/dashboard/CustomQuestionsEditor";
import { AttendeeCustomFieldsEditor } from "../AttendeeCustomFieldsEditor";
import type { AttendeeType, AttendeeCustomField } from "@/lib/validators/attendee-types";
import type { CustomQuestion } from "@/lib/validators/event";
import { saveSectionQuestionsAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = {
  eventId: string;
  attendeeTypes: AttendeeType[] | null;
  initialCustomQuestions: CustomQuestion[];
};

export function SectionQuestions({ eventId, attendeeTypes, initialCustomQuestions }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    saveSectionQuestionsAction.bind(null, eventId),
    null,
  );
  const [regQuestions, setRegQuestions] = useState<CustomQuestion[]>(initialCustomQuestions);
  const [perTypeFields, setPerTypeFields] = useState<Record<string, AttendeeCustomField[]>>(() => {
    const init: Record<string, AttendeeCustomField[]> = {};
    for (const t of attendeeTypes ?? []) init[t.id] = t.customFields ?? [];
    return init;
  });

  const types = attendeeTypes ?? [];
  const isParent = types.length === 2 && types.some((t) => t.name.toLowerCase() === "rodzic");
  const child = isParent ? types.find((t) => t.name.toLowerCase() === "dziecko") : null;
  const parent = isParent ? types.find((t) => t.name.toLowerCase() === "rodzic") : null;
  const single = !isParent && types.length >= 1 ? types[0] : null;
  const isIndividual = !!single && single.maxQty === 1 && single.minQty === 1;
  const hasIndividualPerAttendee =
    isIndividual && (perTypeFields[single!.id]?.length ?? 0) > 0;

  return (
    <SectionShell id="pytania" title="Pytania w formularzu zapisu" action={action} state={state}>
      {/* Hidden inputs reflect current state (customQuestions hidden input is rendered by CustomQuestionsEditor below) */}
      {Object.entries(perTypeFields).map(([typeId, fields]) => (
        <input
          key={typeId}
          type="hidden"
          name={`customFields:${typeId}`}
          value={JSON.stringify(fields)}
        />
      ))}
      {isParent && child && (
        <Card>
          <h3 className="text-sm font-semibold">Pytania o każde dziecko</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Pojawią się dla każdego dziecka osobno — np. wiek, alergie.
          </p>
          <div className="mt-3">
            <AttendeeCustomFieldsEditor
              heading=""
              description=""
              value={perTypeFields[child.id] ?? []}
              onChange={(cf) =>
                setPerTypeFields(
                  (prev) =>
                    ({ ...prev, [child.id]: cf }) as Record<string, AttendeeCustomField[]>,
                )
              }
            />
          </div>
        </Card>
      )}
      {isParent && parent && (
        <Card>
          <h3 className="text-sm font-semibold">
            Pytania o rodzica{" "}
            <span className="font-normal text-muted-foreground text-xs">(opcjonalne)</span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Imię, email i telefon i tak są zbierane.
          </p>
          <div className="mt-3">
            <AttendeeCustomFieldsEditor
              heading=""
              description=""
              value={perTypeFields[parent.id] ?? []}
              onChange={(cf) =>
                setPerTypeFields(
                  (prev) =>
                    ({ ...prev, [parent.id]: cf }) as Record<string, AttendeeCustomField[]>,
                )
              }
            />
          </div>
        </Card>
      )}
      {!isParent && single && (!isIndividual || hasIndividualPerAttendee) && (
        <Card>
          <h3 className="text-sm font-semibold">
            {isIndividual ? "Pytania o uczestnika (starszy układ)" : "Pytania o każdego uczestnika"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {isIndividual
              ? "Wcześniej dodane pytania per-uczestnik. Możesz je tu edytować lub przenieść do sekcji poniżej."
              : "Pojawią się dla każdej osoby w grupie."}
          </p>
          <div className="mt-3">
            <AttendeeCustomFieldsEditor
              heading=""
              description=""
              value={perTypeFields[single.id] ?? []}
              onChange={(cf) =>
                setPerTypeFields(
                  (prev) =>
                    ({ ...prev, [single.id]: cf }) as Record<string, AttendeeCustomField[]>,
                )
              }
            />
          </div>
        </Card>
      )}
      <Card>
        <h3 className="text-sm font-semibold">
          {isIndividual ? "Pytania w formularzu zapisu" : "Pytania raz na całe zgłoszenie"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {isIndividual
            ? "Pojawią się w formularzu zapisu."
            : "Pojawi się raz, niezależnie od liczby osób."}
        </p>
        <div className="mt-3">
          <CustomQuestionsEditor
            initial={regQuestions}
            name="customQuestions"
            onChange={setRegQuestions}
          />
        </div>
      </Card>
    </SectionShell>
  );
}

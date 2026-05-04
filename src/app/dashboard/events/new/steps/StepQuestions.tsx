"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import CustomQuestionsEditor from "@/components/dashboard/CustomQuestionsEditor";
import { AttendeeCustomFieldsEditor } from "@/app/dashboard/events/[id]/AttendeeCustomFieldsEditor";
import type { AttendeeType, AttendeeCustomField } from "@/lib/validators/attendee-types";
import type { CustomQuestion } from "@/lib/validators/event";
import { WizardFooter } from "./StepTitle";

type Props = {
  attendeeTypes: AttendeeType[] | null;
  defaultRegistrationQuestions: CustomQuestion[];
  pending?: boolean;
  onBack: () => void;
  onNext: (
    registrationQuestionsJson: string,
    perAttendeeFieldsByTypeId: Record<string, string>,
  ) => void;
  onSkip: () => void;
};

export function StepQuestions({ attendeeTypes, defaultRegistrationQuestions, pending, onBack, onNext, onSkip }: Props) {
  const [regQuestions, setRegQuestions] = useState<CustomQuestion[]>(defaultRegistrationQuestions);
  const [perTypeFields, setPerTypeFields] = useState<Record<string, AttendeeCustomField[]>>(() => {
    const init: Record<string, AttendeeCustomField[]> = {};
    for (const t of attendeeTypes ?? []) init[t.id] = t.customFields ?? [];
    return init;
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const perTypeJson: Record<string, string> = {};
    for (const t of attendeeTypes ?? []) {
      perTypeJson[t.id] = JSON.stringify(perTypeFields[t.id] ?? []);
    }
    onNext(JSON.stringify(regQuestions), perTypeJson);
  }

  // Determine block layout based on attendee types
  const types = attendeeTypes ?? [];
  const isParent = types.length === 2 && types.some((t) => t.name.toLowerCase() === "rodzic");
  const child = isParent ? types.find((t) => t.name.toLowerCase() === "dziecko") : null;
  const parent = isParent ? types.find((t) => t.name.toLowerCase() === "rodzic") : null;
  const single = !isParent && types.length >= 1 ? types[0] : null;

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        O co chcesz zapytać uczestników?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Wszystkie pytania pojawią się w formularzu zapisu. Możesz pominąć i dodać później.
      </p>
      <div className="mt-7 space-y-4">
        {isParent && child && (
          <Card>
            <h2 className="text-base font-semibold">Pytania o każde dziecko</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pojawią się dla każdego dziecka osobno — np. wiek, alergie, dieta.</p>
            <div className="mt-4">
              <AttendeeCustomFieldsEditor heading="" description="" value={perTypeFields[child.id] ?? []} onChange={(cf) => setPerTypeFields((prev) => ({ ...prev, [child.id]: cf } as Record<string, AttendeeCustomField[]>))} />
            </div>
          </Card>
        )}
        {isParent && parent && (
          <Card>
            <h2 className="text-base font-semibold">Pytania o rodzica <span className="font-normal text-muted-foreground text-sm">(opcjonalne)</span></h2>
            <p className="mt-1 text-sm text-muted-foreground">Imię, email i telefon i tak są zbierane — pytaj tylko o coś dodatkowego, np. nr alarmowy.</p>
            <div className="mt-4">
              <AttendeeCustomFieldsEditor heading="" description="" value={perTypeFields[parent.id] ?? []} onChange={(cf) => setPerTypeFields((prev) => ({ ...prev, [parent.id]: cf } as Record<string, AttendeeCustomField[]>))} />
            </div>
          </Card>
        )}
        {!isParent && single && (
          <Card>
            <h2 className="text-base font-semibold">{single.maxQty > 1 ? "Pytania o każdego uczestnika" : "Pytania o uczestnika"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{single.maxQty > 1 ? "Pojawią się dla każdej osoby w grupie — np. dieta, alergie." : "Pojawią się w formularzu zapisu — np. rozmiar koszulki, dieta."}</p>
            <div className="mt-4">
              <AttendeeCustomFieldsEditor heading="" description="" value={perTypeFields[single.id] ?? []} onChange={(cf) => setPerTypeFields((prev) => ({ ...prev, [single.id]: cf } as Record<string, AttendeeCustomField[]>))} />
            </div>
          </Card>
        )}
        <Card>
          <h2 className="text-base font-semibold">Pytania raz na całe zgłoszenie</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pojawi się raz, niezależnie od liczby osób — np. „Skąd się dowiedziałaś?", uwagi, dane do faktury.</p>
          <div className="mt-4">
            <CustomQuestionsEditor initial={regQuestions} name="customQuestions" onChange={setRegQuestions} />
          </div>
        </Card>
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}

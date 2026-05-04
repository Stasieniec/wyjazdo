"use client";

import { useEffect, useRef, useState } from "react";
import { AttendeeTypesField } from "@/app/dashboard/events/[id]/attendee-types-field";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultAttendeeTypes: AttendeeType[] | null;
  error?: string;
  pending?: boolean;
  onBack: () => void;
  onNext: (attendeeTypesJson: string) => void;
};

export function StepAttendees({ defaultAttendeeTypes, error, pending, onBack, onNext }: Props) {
  const [, setTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const json = String(fd.get("attendeeTypes") ?? "");
    onNext(json);
    setTick((t) => t + 1);
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Kto bierze udział?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Wybierz szablon i ustaw cenę. Pytania o uczestników skonfigurujesz w kolejnym kroku.
      </p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#DC2626]">{error}</p>}
      <div className="mt-7">
        <AttendeeTypesField initialAttendeeTypes={defaultAttendeeTypes} showCustomFieldsEditor={false} />
      </div>
      <WizardFooter onBack={onBack} pending={pending} />
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { EventDateTimeFields } from "@/components/dashboard/EventDateTimeFields";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultStartsAt?: number;
  defaultEndsAt?: number;
  error?: string;
  pending?: boolean;
  onBack: () => void;
  onNext: (startsAtMs: number, endsAtMs: number) => void;
};

export function StepDates({ defaultStartsAt, defaultEndsAt, error, pending, onBack, onNext }: Props) {
  const [, setTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const startsRaw = String(fd.get("startsAt") ?? "");
    const endsRaw = String(fd.get("endsAt") ?? "");
    const starts = startsRaw ? new Date(startsRaw).getTime() : NaN;
    const ends = endsRaw ? new Date(endsRaw).getTime() : NaN;
    if (Number.isFinite(starts) && Number.isFinite(ends)) onNext(starts, ends);
    else setTick((t) => t + 1); // re-render to keep error visible
  }

  return (
    <form ref={formRef} className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Kiedy się odbywa?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Wybierz datę i godzinę początku oraz końca.
      </p>
      <div className="mt-7">
        <EventDateTimeFields defaultStartsAt={defaultStartsAt} defaultEndsAt={defaultEndsAt} error={error} />
      </div>
      <WizardFooter onBack={onBack} pending={pending} />
    </form>
  );
}

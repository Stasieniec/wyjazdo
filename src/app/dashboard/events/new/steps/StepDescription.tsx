"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultValue?: string;
  error?: string;
  pending?: boolean;
  onBack: () => void;
  onNext: (value: string) => void;
  onSkip: () => void;
};

export function StepDescription({ defaultValue = "", error, pending, onBack, onNext, onSkip }: Props) {
  const [value, setValue] = useState(defaultValue);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); onNext(value); }}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Opowiedz krótko o czym to jest
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Co to za wydarzenie? Co uczestniczki tam zrobią? Możesz pominąć i dopisać później.
      </p>
      <div className="mt-7">
        <Textarea name="description" rows={6} value={value} onChange={(e) => setValue(e.target.value)} maxLength={10_000} error={error} />
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}

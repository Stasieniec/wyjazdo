"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultValue?: number;
  error?: string;
  pending?: boolean;
  onBack: () => void;
  onNext: (value: number) => void;
};

export function StepCapacity({ defaultValue, error, pending, onBack, onNext }: Props) {
  const [value, setValue] = useState(defaultValue?.toString() ?? "");
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); onNext(Number(value)); }}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Ile osób maksymalnie?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Liczy się każda osoba w zgłoszeniu, też dzieci i osoby zapisane razem (np. w grupie). Jeśli rodzic zapisze siebie i 2 dzieci, to 3 miejsca.
      </p>
      <div className="mt-7">
        <Input name="capacity" type="number" label="Liczba miejsc" min={1} max={10000} required value={value} onChange={(e) => setValue(e.target.value)} error={error} />
      </div>
      <WizardFooter onBack={onBack} pending={pending} />
    </form>
  );
}

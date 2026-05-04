"use client";

import { useEffect, useRef, useState } from "react";
import EventConsentsEditor from "@/components/dashboard/EventConsentsEditor";
import type { ConsentConfigItem } from "@/lib/validators/consent";

type Props = {
  defaultConsents: ConsentConfigItem[];
  pending?: boolean;
  onBack: () => void;
  onNext: (consentsJson: string) => void;
  onSkip: () => void;
};

export function StepConsents({ defaultConsents, pending, onBack, onNext, onSkip }: Props) {
  const [consents, setConsents] = useState<ConsentConfigItem[]>(defaultConsents);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onNext(JSON.stringify(consents));
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Zgody i regulaminy
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Te zgody są zawsze pokazywane uczestniczkom: regulamin platformy, polityka prywatności, przetwarzanie danych. Poniżej możesz dodać własne — np. zgodę na wykorzystanie wizerunku, regulamin wydarzenia.
      </p>
      <div className="mt-7">
        <EventConsentsEditor initial={consents} name="consentConfig" onChange={setConsents} />
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
        <button type="submit" disabled={pending} className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] disabled:opacity-60 md:flex-1">
          {pending ? "Zapisuję…" : "Zakończ tworzenie →"}
        </button>
        <button type="button" onClick={onBack} className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] md:w-auto">← Wstecz</button>
        <button type="button" onClick={onSkip} className="w-full px-4 py-3 text-sm text-[#6B7280] underline hover:text-[#1E3A5F] md:w-auto">Pomiń teraz, ustawię później</button>
      </div>
    </form>
  );
}

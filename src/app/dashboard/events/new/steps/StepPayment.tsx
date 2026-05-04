"use client";

import { useEffect, useRef, useState } from "react";
import { Input, ZlotyInput } from "@/components/ui";
import { WizardFooter } from "./StepTitle";
import { toDatetimeLocalValue, timestampToDdMmYyyyAndTime, parseDdMmYyyy, parseTimeHm } from "@/lib/datetime-form";

type Props = {
  defaultDepositCents?: number | null;
  defaultBalanceDueAt?: number | null;
  errors?: { depositCents?: string; balanceDueAt?: string };
  pending?: boolean;
  onBack: () => void;
  onNext: (depositOn: boolean, depositCents: number | null, balanceDueAt: number | null) => void;
  onSkip: () => void;
};

export function StepPayment({ defaultDepositCents, defaultBalanceDueAt, errors, pending, onBack, onNext, onSkip }: Props) {
  const [depositOn, setDepositOn] = useState(defaultDepositCents != null && defaultDepositCents > 0);
  const [depositCents, setDepositCents] = useState<number>(defaultDepositCents ?? 0);
  const [balanceDueAt, setBalanceDueAt] = useState(() => {
    if (defaultBalanceDueAt == null) return "";
    const { date, time } = timestampToDdMmYyyyAndTime(defaultBalanceDueAt);
    const parts = parseDdMmYyyy(date);
    const t = parseTimeHm(time);
    if (!parts || !t) return "";
    return toDatetimeLocalValue(parts, t);
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ms = balanceDueAt ? new Date(balanceDueAt).getTime() : null;
    onNext(depositOn, depositOn ? depositCents : null, depositOn ? ms : null);
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Jak chcesz pobierać płatność?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Domyślnie uczestniczki płacą całą kwotę przy zapisie. Możesz pobrać tylko zaliczkę i wyznaczyć termin dopłaty.
      </p>
      <div className="mt-7 space-y-4 rounded-2xl bg-white p-5 shadow-[0_8px_20px_rgba(30,58,95,0.06)]">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={depositOn} onChange={(e) => setDepositOn(e.target.checked)} />
          <span>Pobieram tylko zaliczkę</span>
        </label>
        {depositOn && (
          <div className="space-y-3 border-t border-border pt-3">
            <label className="block text-sm">
              Zaliczka za osobę (PLN)
              <ZlotyInput valueCents={depositCents} onChangeCents={setDepositCents} className="mt-1 w-full rounded border border-border px-2 py-1" />
              {errors?.depositCents && <p className="mt-1 text-sm text-destructive">{errors.depositCents}</p>}
            </label>
            <Input name="balanceDueAt" type="datetime-local" label="Termin dopłaty reszty" value={balanceDueAt} onChange={(e) => setBalanceDueAt(e.target.value)} required={depositOn} error={errors?.balanceDueAt} />
          </div>
        )}
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}

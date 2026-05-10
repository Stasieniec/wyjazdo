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
        Wybierz jeden z dwóch sposobów. Możesz to zmienić później.
      </p>
      <div className="mt-7 space-y-3">
        <label
          className={`block cursor-pointer rounded-2xl border-2 bg-white p-4 transition ${
            !depositOn ? "border-[#E8683A] shadow-[0_8px_20px_rgba(232,104,58,0.15)]" : "border-border hover:border-[#E8683A]/40"
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="paymentMode"
              value="full"
              checked={!depositOn}
              onChange={() => setDepositOn(false)}
              className="mt-1.5"
            />
            <div className="flex-1">
              <div className="text-base font-semibold text-[#1E3A5F]">Cała kwota od razu</div>
              <p className="mt-1 text-sm text-[#6B7280]">
                Uczestnicy płacą pełną cenę przy zapisie. Najprostsze — masz pieniądze od razu, nie musisz pilnować dopłat.
              </p>
            </div>
          </div>
        </label>

        <label
          className={`block cursor-pointer rounded-2xl border-2 bg-white p-4 transition ${
            depositOn ? "border-[#E8683A] shadow-[0_8px_20px_rgba(232,104,58,0.15)]" : "border-border hover:border-[#E8683A]/40"
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="paymentMode"
              value="deposit"
              checked={depositOn}
              onChange={() => setDepositOn(true)}
              className="mt-1.5"
            />
            <div className="flex-1">
              <div className="text-base font-semibold text-[#1E3A5F]">Zaliczka teraz, reszta później</div>
              <p className="mt-1 text-sm text-[#6B7280]">
                Uczestnicy płacą tylko zaliczkę przy zapisie. Resztę dopłacają do wyznaczonego przez Ciebie terminu (np. miesiąc przed wydarzeniem).
              </p>
              {depositOn && (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <label className="block text-sm">
                    <span className="font-medium text-[#1E3A5F]">Zaliczka za osobę (PLN)</span>
                    <ZlotyInput valueCents={depositCents} onChangeCents={setDepositCents} className="mt-1 w-full rounded border border-border px-2 py-1" />
                    {errors?.depositCents && <p className="mt-1 text-sm text-destructive">{errors.depositCents}</p>}
                  </label>
                  <Input
                    name="balanceDueAt"
                    type="datetime-local"
                    label="Termin dopłaty reszty"
                    value={balanceDueAt}
                    onChange={(e) => setBalanceDueAt(e.target.value)}
                    required
                    error={errors?.balanceDueAt}
                  />
                </div>
              )}
            </div>
          </div>
        </label>
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}

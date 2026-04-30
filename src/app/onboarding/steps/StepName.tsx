"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  onBack: () => void;
  onNext: () => void;
};

export function StepName({ value, onChange, error, onBack, onNext }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        Jak nazywa się Twoja firma?
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Tak będzie wyświetlana na stronie zapisów dla uczestników.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#DC2626]"
        >
          {error}
        </p>
      )}

      <div className="mt-7 rounded-2xl bg-white p-5 shadow-[0_12px_32px_rgba(30,58,95,0.10),0_2px_4px_rgba(30,58,95,0.04)]">
        <label
          htmlFor="onboarding-displayName"
          className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280]"
        >
          Nazwa
        </label>
        <input
          id="onboarding-displayName"
          name="displayName"
          type="text"
          autoComplete="organization"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={100}
          placeholder="np. Górskie Wyjazdy"
          className="mt-1.5 block w-full border-0 border-b-2 border-[#E5E7EB] bg-transparent px-0 py-2 text-lg font-medium text-[#1E3A5F] outline-none placeholder:text-[#B0B5BC] focus:border-[#E8683A] md:text-xl"
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
        <button
          type="submit"
          className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] md:flex-1"
        >
          Dalej →
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] md:w-auto"
        >
          ← Wstecz
        </button>
      </div>
    </form>
  );
}

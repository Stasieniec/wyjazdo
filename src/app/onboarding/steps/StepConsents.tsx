"use client";

import { useEffect, useRef } from "react";

type Props = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptDpa: boolean;
  onChange: (key: "acceptTerms" | "acceptPrivacy" | "acceptDpa", next: boolean) => void;
  onAcceptAll: () => void;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

export function StepConsents({
  acceptTerms,
  acceptPrivacy,
  acceptDpa,
  onChange,
  onAcceptAll,
  error,
  pending,
  onBack,
  onSubmit,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const allChecked = acceptTerms && acceptPrivacy && acceptDpa;

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) onSubmit();
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        Ostatni krok — dokumenty i zgody
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Wymagane przez RODO i regulamin serwisu.
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
        <button
          type="button"
          onClick={onAcceptAll}
          disabled={allChecked}
          className="mb-4 w-full rounded-lg border border-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] transition hover:bg-[#1E3A5F] hover:text-white disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:bg-[#F4F4F5] disabled:text-[#B0B5BC]"
        >
          {allChecked ? "✓ Wszystkie zgody zaznaczone" : "Zaakceptuj wszystkie"}
        </button>

        <ConsentRow
          id="acceptTerms"
          checked={acceptTerms}
          onChange={(v) => onChange("acceptTerms", v)}
        >
          Akceptuję{" "}
          <a
            href="/organizer-terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#1E3A5F] underline underline-offset-4 hover:text-[#E8683A]"
          >
            Regulamin dla Organizatorów wyjazdo.pl
          </a>
        </ConsentRow>
        <ConsentRow
          id="acceptPrivacy"
          checked={acceptPrivacy}
          onChange={(v) => onChange("acceptPrivacy", v)}
        >
          Zapoznałem/am się z{" "}
          <a
            href="/polityka-prywatnosci"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#1E3A5F] underline underline-offset-4 hover:text-[#E8683A]"
          >
            Polityką Prywatności
          </a>
        </ConsentRow>
        <ConsentRow
          id="acceptDpa"
          checked={acceptDpa}
          onChange={(v) => onChange("acceptDpa", v)}
        >
          Akceptuję{" "}
          <a
            href="/dpa"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#1E3A5F] underline underline-offset-4 hover:text-[#E8683A]"
          >
            Umowę powierzenia przetwarzania danych osobowych
          </a>{" "}
          (art. 28 RODO)
        </ConsentRow>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
        <button
          type="submit"
          disabled={!allChecked || pending}
          className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#B0B5BC] disabled:shadow-none md:flex-1"
        >
          {pending ? "Tworzenie..." : "Utwórz profil →"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] disabled:opacity-50 md:w-auto"
        >
          ← Wstecz
        </button>
      </div>
    </form>
  );
}

function ConsentRow({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 py-2.5 text-sm leading-relaxed text-[#1E3A5F]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-[#E5E7EB] accent-[#1E3A5F]"
      />
      <span>{children}</span>
    </label>
  );
}

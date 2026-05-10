"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  onBack: () => void;
  onNext: () => void;
};

const ROOT_DOMAIN = "wyjazdo.pl";

/** Live-sanitize as user types: lowercase, ASCII-only, dashes for invalid runs. */
function sanitize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9-]+/g, "-")
    .slice(0, 32);
}

export function StepSubdomain({ value, onChange, error, onBack, onNext }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const previewSlug = value.replace(/^-+|-+$/g, "") || "twoja-nazwa";

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
        Twój adres do zapisów
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Krótki adres, który będziesz wysyłać uczestnikom — sugerujemy go na podstawie nazwy.
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
          htmlFor="onboarding-subdomain"
          className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280]"
        >
          Adres
        </label>
        <input
          id="onboarding-subdomain"
          name="subdomain"
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          placeholder="gorskie-wyjazdy"
          className="mt-1.5 block w-full border-0 border-b-2 border-[#E5E7EB] bg-transparent px-0 py-2 text-lg font-medium text-[#1E3A5F] outline-none placeholder:text-[#B0B5BC] focus:border-[#E8683A] md:text-xl"
        />
        <p className="mt-3 text-xs text-[#6B7280]">
          Twoja strona:{" "}
          <code className="rounded border border-[#F4E5DC] bg-[#FFF8F4] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#1E3A5F]">
            {previewSlug}.{ROOT_DOMAIN}
          </code>
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-[#F4E5DC] bg-white/70 px-4 py-3 text-xs leading-relaxed text-[#6B7280]">
        <strong className="text-[#1E3A5F]">Co to jest?</strong> Każdy organizator ma własny adres
        — tam uczestnicy zapisują się na Twoje wyjazdy. Wybieraj rozważnie: zmiana po założeniu
        konta jest możliwa, ale link, który już wyślesz uczestnikom, przestanie działać.
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

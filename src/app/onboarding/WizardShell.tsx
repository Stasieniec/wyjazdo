"use client";

import { type ReactNode } from "react";

type Props = {
  /** Current input-step number, 1..5. Pass null for the welcome screen (no pill). */
  currentStep: number | null;
  /** Total number of input steps. */
  totalSteps: number;
  children: ReactNode;
};

export function WizardShell({ currentStep, totalSteps, children }: Props) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#FFF8F4]">
      {/* Coral blob — top right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 h-[340px] w-[340px] rounded-full blur-[2px] md:-top-48 md:-right-40 md:h-[540px] md:w-[540px]"
        style={{
          background:
            "radial-gradient(circle, rgba(232,104,58,0.33) 0%, rgba(232,104,58,0.13) 40%, transparent 70%)",
        }}
      />
      {/* Navy blob — bottom left */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 h-[280px] w-[280px] rounded-full blur-[2px] md:-bottom-48 md:-left-40 md:h-[460px] md:w-[460px]"
        style={{
          background:
            "radial-gradient(circle, rgba(30,58,95,0.20) 0%, rgba(30,58,95,0.07) 40%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-6 py-8 md:max-w-[560px] md:px-8 md:py-12 md:justify-center">
        {currentStep !== null && (
          <header className="flex flex-col gap-3" aria-live="polite">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-[#1E3A5F] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8683A]" />
              Krok {currentStep} z {totalSteps}
            </span>
            <ol className="flex gap-1.5" aria-label="Postęp">
              {Array.from({ length: totalSteps }).map((_, i) => {
                const idx = i + 1;
                const state = idx < currentStep ? "done" : idx === currentStep ? "current" : "pending";
                const bg =
                  state === "done"
                    ? "bg-[#1E3A5F]"
                    : state === "current"
                      ? "bg-[#E8683A]"
                      : "bg-[#F4E5DC]";
                return <li key={idx} className={`h-1 flex-1 rounded-full ${bg}`} />;
              })}
            </ol>
          </header>
        )}

        <div className="mt-10 flex flex-1 flex-col md:mt-12">{children}</div>
      </div>
    </div>
  );
}

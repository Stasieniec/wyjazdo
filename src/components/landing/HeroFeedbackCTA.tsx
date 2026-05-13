"use client";

import { useEffect, useState } from "react";

const MAILTO =
  "mailto:kontakt@wyjazdo.pl?subject=Rozmowa%20o%20Wyjazdo";

export function HeroFeedbackCTA() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-7 py-4 text-base font-semibold text-white shadow-[--shadow-warm] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_8px_24px_rgba(232,104,58,0.4)] active:translate-y-0 active:scale-[0.98] sm:w-auto sm:justify-start"
      >
        Zobacz, ile czasu zaoszczędzisz →
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="hero-feedback-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_20px_60px_rgba(30,58,95,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="hero-feedback-title"
              className="font-[family-name:var(--font-ibm-plex-serif)] text-2xl font-semibold leading-tight text-primary"
            >
              Jesteśmy w fazie wczesnego startu
            </h2>
            <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
              <p>
                Wyjazdo dopiero raczkuje — wypuszczamy platformę do
                pierwszych organizatorek i&nbsp;ogromnie cenimy każdą
                uwagę oraz pomysł, które od Was dostajemy.
              </p>
              <p>
                Jeśli chcesz, możemy się umówić na rozmowę online albo
                spotkać się na żywo — pokażę Ci, jak Wyjazdo może
                oszczędzić Ci czasu przy zapisach, płatnościach
                i&nbsp;kontakcie z&nbsp;uczestniczkami.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center rounded-xl border border-primary/15 bg-white px-5 py-3 text-sm font-semibold text-primary transition-all duration-200 hover:border-primary/25 hover:bg-white hover:shadow-[0_6px_16px_rgba(30,58,95,0.12)] active:scale-[0.98]"
              >
                Zamknij
              </button>
              <a
                href={MAILTO}
                className="inline-flex items-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_8px_24px_rgba(232,104,58,0.4)] active:translate-y-0 active:scale-[0.98]"
              >
                Napisz do nas →
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

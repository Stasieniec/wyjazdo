"use client";

import { useEffect, useRef, useState } from "react";
import { SECTION_LABELS } from "./SectionRail";
import type { SectionId, SectionStatus } from "./section-status";

type Props = {
  status: Record<SectionId, SectionStatus>;
  publishSlot: React.ReactNode;
};

export function SectionSheet({ status, publishSlot }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const filledCount = (Object.values(status) as SectionStatus[]).filter((s) => s === "filled" || s === "free").length;
  const total = Object.keys(SECTION_LABELS).length;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function jumpTo(id: SectionId) {
    setOpen(false);
    triggerRef.current?.focus();
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Wydarzenie</div>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Sekcje ▾
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex flex-1 gap-1">
            {(Object.keys(SECTION_LABELS) as SectionId[]).map((id) => {
              const s = status[id];
              const bg = s === "filled" ? "bg-[#1E3A5F]" : s === "free" ? "bg-[#1E3A5F]/40" : "bg-[#F4E5DC]";
              return <div key={id} className={`h-1 flex-1 rounded-full ${bg}`} />;
            })}
          </div>
          <span>{filledCount} z {total} sekcji wypełnionych</span>
        </div>
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Sekcje wydarzenia" className="fixed inset-0 z-40 flex items-end bg-black/40 sm:hidden" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full rounded-t-2xl bg-background p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Sekcje</h2>
              <button ref={closeRef} type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} aria-label="Zamknij" className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
                ✕
              </button>
            </div>
            <ul className="space-y-1">
              {(Object.keys(SECTION_LABELS) as SectionId[]).map((id) => {
                const s = status[id];
                return (
                  <li key={id}>
                    <button type="button" onClick={() => jumpTo(id)} className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-muted">
                      <span aria-hidden className="w-3 text-xs">{s === "filled" ? "✓" : "○"}</span>
                      <span className={s === "filled" ? "text-foreground" : "text-muted-foreground"}>{SECTION_LABELS[id]}</span>
                      {s === "free" && id === "platnosc" && <span className="text-[10px] text-muted-foreground">— darmowe</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t border-border pt-4">{publishSlot}</div>
          </div>
        </div>
      )}
    </>
  );
}

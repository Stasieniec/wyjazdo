"use client";

import { useEffect, useState } from "react";
import type { SectionId, SectionStatus } from "./section-status";

export const SECTION_LABELS: Record<SectionId, string> = {
  podstawy: "Podstawy",
  termin: "Termin",
  miejsce: "Miejsce",
  uczestnicy: "Uczestnicy",
  miejsca: "Liczba miejsc",
  platnosc: "Płatność",
  zdjecia: "Zdjęcia",
  pytania: "Pytania",
  zgody: "Zgody",
};

type Props = {
  status: Record<SectionId, SectionStatus>;
  publishSlot: React.ReactNode; // <PublishButton> rendered by parent
};

export function SectionRail({ status, publishSlot }: Props) {
  const [active, setActive] = useState<SectionId | null>(null);

  useEffect(() => {
    const sections = Object.keys(SECTION_LABELS) as SectionId[];
    const elements = sections
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost visible
          const topMost = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
          setActive(topMost.target.id as SectionId);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function jumpTo(id: SectionId) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <aside className="sticky top-6 hidden w-[200px] shrink-0 sm:block">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sekcje
      </p>
      <ul className="mt-3 space-y-1">
        {(Object.keys(SECTION_LABELS) as SectionId[]).map((id) => {
          const s = status[id];
          const isActive = active === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => jumpTo(id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? "border-l-2 border-[#E8683A] bg-[#FFF4ED] pl-2.5"
                    : "border-l-2 border-transparent hover:bg-muted"
                }`}
              >
                <span aria-hidden className="w-3 text-xs">
                  {s === "filled" ? "✓" : s === "free" ? "○" : "○"}
                </span>
                <span className={s === "filled" ? "text-foreground" : "text-muted-foreground"}>
                  {SECTION_LABELS[id]}
                </span>
                {s === "free" && id === "platnosc" && (
                  <span className="text-[10px] text-muted-foreground">— darmowe</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 border-t border-border pt-4">{publishSlot}</div>
    </aside>
  );
}

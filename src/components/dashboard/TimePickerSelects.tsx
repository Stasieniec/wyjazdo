"use client";

import { useMemo } from "react";
import { parseTimeHm } from "@/lib/datetime-form";

export const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
export const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function TimePickerSelects({
  idPrefix,
  timeStr,
  setTimeStr,
}: {
  idPrefix: string;
  timeStr: string;
  setTimeStr: (v: string) => void;
}) {
  const parsed = useMemo(() => parseTimeHm(timeStr), [timeStr]);
  const hourVal = parsed ? String(parsed.h).padStart(2, "0") : "";
  const minuteVal = parsed ? String(parsed.min).padStart(2, "0") : "";

  return (
    <div className="flex shrink-0 items-end gap-1">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-muted-foreground" id={`${idPrefix}-hour-hint`}>
          Godz.
        </span>
        <div className="relative">
          <select
            id={`${idPrefix}-hour`}
            aria-labelledby={`${idPrefix}-hour-hint`}
            className="h-10 min-w-[4.85rem] cursor-pointer appearance-none rounded-md border border-border pl-2 pr-8 text-sm tabular-nums text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
            value={hourVal}
            required
            onChange={(e) => {
              const h = e.target.value;
              if (!h) {
                setTimeStr("");
                return;
              }
              setTimeStr(`${h}:${minuteVal || "00"}`);
            }}
          >
            <option value="">—</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <SelectChevron className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>
      <span className="mb-2 select-none text-sm text-muted-foreground" aria-hidden>
        :
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-muted-foreground" id={`${idPrefix}-min-hint`}>
          Min.
        </span>
        <div className="relative">
          <select
            id={`${idPrefix}-minute`}
            aria-labelledby={`${idPrefix}-min-hint`}
            disabled={!hourVal}
            className="h-10 min-w-[4.85rem] cursor-pointer appearance-none rounded-md border border-border pl-2 pr-8 text-sm tabular-nums text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            value={hourVal ? minuteVal : ""}
            required={Boolean(hourVal)}
            onChange={(e) => {
              const m = e.target.value;
              if (!hourVal || !m) return;
              setTimeStr(`${hourVal}:${m}`);
            }}
          >
            {!hourVal ? (
              <option value="">—</option>
            ) : (
              MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            )}
          </select>
          <SelectChevron className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>
    </div>
  );
}

function SelectChevron({ className }: { className?: string }) {
  return (
    <svg
      className={`${className ?? ""} h-4 w-4 text-muted-foreground`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  formatDdMmYyyyInput,
  parseDdMmYyyy,
  parseTimeHm,
  timestampToDdMmYyyyAndTime,
  toDatetimeLocalValue,
  yyyyMmDdToDdMmYyyy,
} from "@/lib/datetime-form";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

type Props = {
  name: string;
  label: string;
  /** Unix ms in local timezone — for edit forms */
  defaultTimestamp?: number;
};

export function DateTimePickerField({ name, label, defaultTimestamp }: Props) {
  const id = useId();
  const datePickerRef = useRef<HTMLInputElement>(null);
  const dateTextRef = useRef<HTMLInputElement>(null);

  const [dateStr, setDateStr] = useState(() =>
    defaultTimestamp != null ? timestampToDdMmYyyyAndTime(defaultTimestamp).date : "",
  );
  const [timeStr, setTimeStr] = useState(() =>
    defaultTimestamp != null ? timestampToDdMmYyyyAndTime(defaultTimestamp).time : "",
  );

  const combined = useMemo(() => {
    const date = parseDdMmYyyy(dateStr);
    const time = parseTimeHm(timeStr);
    if (!date || !time) return "";
    return toDatetimeLocalValue(date, time);
  }, [dateStr, timeStr]);

  const isoDate = useMemo(() => {
    const date = parseDdMmYyyy(dateStr);
    if (!date) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.y}-${pad(date.m)}-${pad(date.d)}`;
  }, [dateStr]);

  const showError = dateStr.length > 0 && timeStr.length > 0 && !combined;

  useEffect(() => {
    const el = dateTextRef.current;
    if (!el) return;
    if (!dateStr.trim() || !timeStr.trim()) {
      el.setCustomValidity("");
      return;
    }
    if (!combined) {
      el.setCustomValidity("Podaj poprawną datę (dd/mm/rrrr).");
    } else {
      el.setCustomValidity("");
    }
  }, [combined, dateStr, timeStr]);

  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1 flex gap-2">
        <input
          ref={dateTextRef}
          id={`${id}-date`}
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/rrrr"
          autoComplete="off"
          required
          value={dateStr}
          onChange={(e) => setDateStr(formatDdMmYyyyInput(e.target.value))}
          className="min-w-0 flex-1 rounded-md border px-3 py-2"
          aria-invalid={showError}
          aria-describedby={showError ? `${id}-err` : undefined}
        />
        <TimePickerSelects idPrefix={id} timeStr={timeStr} setTimeStr={setTimeStr} />
        <input
          ref={datePickerRef}
          type="date"
          className="sr-only"
          tabIndex={-1}
          value={isoDate}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const ddmm = yyyyMmDdToDdMmYyyy(v);
            if (ddmm) setDateStr(ddmm);
          }}
        />
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
          aria-label="Wybierz datę z kalendarza"
          onClick={() => {
            const el = datePickerRef.current;
            if (!el) return;
            if (typeof el.showPicker === "function") el.showPicker();
            else el.click();
          }}
        >
          <CalendarIcon className="h-5 w-5" />
        </button>
      </div>
      <input type="hidden" name={name} value={combined} />
      {showError && (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-600" role="alert">
          Podaj poprawną datę i godzinę.
        </p>
      )}
    </label>
  );
}

function TimePickerSelects({
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
        <span className="text-[10px] font-medium text-neutral-500" id={`${idPrefix}-hour-hint`}>
          Godz.
        </span>
        <div className="relative">
          <select
            id={`${idPrefix}-hour`}
            aria-labelledby={`${idPrefix}-hour-hint`}
            className="h-10 min-w-[4.85rem] cursor-pointer appearance-none rounded-md border pl-2 pr-8 text-sm tabular-nums text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500/25"
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
      <span className="mb-2 select-none text-sm text-neutral-400" aria-hidden>
        :
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-neutral-500" id={`${idPrefix}-min-hint`}>
          Min.
        </span>
        <div className="relative">
          <select
            id={`${idPrefix}-minute`}
            aria-labelledby={`${idPrefix}-min-hint`}
            disabled={!hourVal}
            className="h-10 min-w-[4.85rem] cursor-pointer appearance-none rounded-md border pl-2 pr-8 text-sm tabular-nums text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500/25 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
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
      className={`${className ?? ""} h-4 w-4 text-neutral-500`}
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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

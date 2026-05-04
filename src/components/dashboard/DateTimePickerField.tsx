"use client";

import { useEffect, useId, useRef, useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import { TimePickerSelects } from "./TimePickerSelects";
import {
  combineLocalDateAndTime,
  formatDdMmYyyyFromDate,
  formatDdMmYyyyInput,
  parseDdMmYyyy,
  startOfLocalDay,
  timestampToDdMmYyyyAndTime,
} from "@/lib/datetime-form";

import "react-day-picker/style.css";

type Props = {
  /** Hidden form field name carrying the combined "YYYY-MM-DDTHH:mm" value. */
  name: string;
  label: string;
  defaultValue?: number; // unix ms
  defaultTime?: string; // "HH:mm"
  required?: boolean;
  onChange?: (msOrNull: number | null) => void;
};

export function DateTimePickerField({
  name,
  label,
  defaultValue,
  defaultTime = "09:00",
  required,
  onChange,
}: Props) {
  const id = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef<string | null>(null);

  const [date, setDate] = useState<Date | undefined>(() =>
    defaultValue != null ? startOfLocalDay(defaultValue) : undefined,
  );
  const [dateStr, setDateStr] = useState(() =>
    defaultValue != null ? formatDdMmYyyyFromDate(startOfLocalDay(defaultValue)) : "",
  );
  const [timeStr, setTimeStr] = useState(() =>
    defaultValue != null ? timestampToDdMmYyyyAndTime(defaultValue).time : defaultTime,
  );
  const [open, setOpen] = useState(false);

  const combined = !date ? "" : combineLocalDateAndTime(date, timeStr) ?? "";

  useEffect(() => {
    if (!onChange) return;
    if (lastSentRef.current === combined) return;
    lastSentRef.current = combined;
    if (!combined) {
      onChange(null);
      return;
    }
    const t = new Date(combined).getTime();
    onChange(Number.isNaN(t) ? null : t);
  }, [combined, onChange]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function clickHandler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  function handleManualBlur() {
    const parts = parseDdMmYyyy(dateStr.trim());
    if (!parts) {
      setDate(undefined);
      return;
    }
    setDate(new Date(parts.y, parts.m - 1, parts.d));
  }

  function handlePick(d: Date | undefined) {
    setDate(d);
    setDateStr(d ? formatDdMmYyyyFromDate(d) : "");
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-border bg-white/60 p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-2 flex items-end gap-2">
        <label className="relative flex-1">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/rrrr"
            value={dateStr}
            onChange={(e) => setDateStr(formatDdMmYyyyInput(e.target.value))}
            onFocus={() => setOpen(true)}
            onBlur={handleManualBlur}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={label}
            aria-controls={`${id}-cal`}
            aria-expanded={open}
            required={required}
          />
          {open && (
            <div
              ref={popoverRef}
              id={`${id}-cal`}
              className="absolute left-0 top-full z-30 mt-1 rounded-xl border border-border bg-background p-2 shadow-lg"
            >
              <DayPicker
                mode="single"
                locale={pl}
                weekStartsOn={1}
                numberOfMonths={1}
                selected={date}
                onSelect={handlePick}
                className="[--rdp-accent-color:var(--primary)]"
              />
            </div>
          )}
        </label>
        <TimePickerSelects idPrefix={`${id}-time`} timeStr={timeStr} setTimeStr={setTimeStr} />
      </div>
      {date && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {format(date, "EEE d MMM", { locale: pl })} · {timeStr}
        </p>
      )}
      <input type="hidden" name={name} value={combined} />
    </div>
  );
}

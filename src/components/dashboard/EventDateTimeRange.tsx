"use client";

import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { combineLocalDateAndTime, startOfLocalDay, timestampToDdMmYyyyAndTime } from "@/lib/datetime-form";
import { TimePickerSelects } from "./TimePickerSelects";

import "react-day-picker/style.css";

type Props = {
  /** Unix ms — edit forms */
  defaultStartsAt?: number;
  defaultEndsAt?: number;
};

export function EventDateTimeRange({ defaultStartsAt, defaultEndsAt }: Props) {
  const id = useId();
  const validityRef = useRef<HTMLInputElement>(null);

  const [range, setRange] = useState<DateRange | undefined>(() => {
    if (defaultStartsAt != null && defaultEndsAt != null) {
      return {
        from: startOfLocalDay(defaultStartsAt),
        to: startOfLocalDay(defaultEndsAt),
      };
    }
    return undefined;
  });

  const [startTimeStr, setStartTimeStr] = useState(() =>
    defaultStartsAt != null ? timestampToDdMmYyyyAndTime(defaultStartsAt).time : "09:00",
  );
  const [endTimeStr, setEndTimeStr] = useState(() =>
    defaultEndsAt != null ? timestampToDdMmYyyyAndTime(defaultEndsAt).time : "17:00",
  );

  const startsCombined = useMemo(() => {
    if (!range?.from) return "";
    return combineLocalDateAndTime(range.from, startTimeStr) ?? "";
  }, [range?.from, startTimeStr]);

  const endsCombined = useMemo(() => {
    if (!range?.to) return "";
    return combineLocalDateAndTime(range.to, endTimeStr) ?? "";
  }, [range?.to, endTimeStr]);

  const startsMs = useMemo(() => {
    if (!startsCombined) return null;
    const t = new Date(startsCombined).getTime();
    return Number.isNaN(t) ? null : t;
  }, [startsCombined]);

  const endsMs = useMemo(() => {
    if (!endsCombined) return null;
    const t = new Date(endsCombined).getTime();
    return Number.isNaN(t) ? null : t;
  }, [endsCombined]);

  const durationHint = useMemo(() => {
    if (startsMs == null || endsMs == null || endsMs <= startsMs) return null;
    const mins = Math.round((endsMs - startsMs) / 60_000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return h === 1 ? "1 godz." : `${h} godz.`;
    return `${h} godz. ${m} min`;
  }, [startsMs, endsMs]);

  useEffect(() => {
    const el = validityRef.current;
    if (!el) return;
    if (!range?.from || !range?.to) {
      el.setCustomValidity("Wybierz datę początku i końca w kalendarzu.");
      return;
    }
    if (!startsCombined || !endsCombined) {
      el.setCustomValidity("Uzupełnij godziny rozpoczęcia i zakończenia.");
      return;
    }
    if (endsMs != null && startsMs != null && endsMs <= startsMs) {
      el.setCustomValidity("Koniec wydarzenia musi być po jego początku.");
      return;
    }
    el.setCustomValidity("");
  }, [range?.from, range?.to, startsCombined, endsCombined, startsMs, endsMs]);

  const defaultMonth = useMemo(
    () => range?.from ?? range?.to ?? new Date(),
    [range?.from, range?.to],
  );

  return (
    <fieldset className="relative space-y-3">
      <legend className="text-sm font-medium">Termin wydarzenia</legend>
      <p className="text-xs text-neutral-500">
        Wybierz pierwszy i ostatni dzień w kalendarzu, potem ustal godziny rozpoczęcia i zakończenia.
      </p>

      <input
        ref={validityRef}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        className="sr-only"
        aria-hidden
      />

      <div className="flex justify-center overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 shadow-sm sm:p-4">
        <DayPicker
          mode="range"
          locale={pl}
          weekStartsOn={1}
          numberOfMonths={1}
          defaultMonth={defaultMonth}
          selected={range}
          onSelect={setRange}
          className="mx-auto [--rdp-accent-color:#171717] [--rdp-accent-background-color:#e5e5e5]"
        />
      </div>

      {range?.from && range?.to && (
        <p className="text-center text-sm text-neutral-600">
          <span className="tabular-nums">{format(range.from, "EEE d MMM", { locale: pl })}</span>
          <span className="mx-1.5 text-neutral-400">·</span>
          <span className="tabular-nums">{startTimeStr}</span>
          <span className="mx-2 text-neutral-400" aria-hidden>
            →
          </span>
          <span className="tabular-nums">{format(range.to, "EEE d MMM", { locale: pl })}</span>
          <span className="mx-1.5 text-neutral-400">·</span>
          <span className="tabular-nums">{endTimeStr}</span>
          {durationHint && (
            <span className="text-neutral-500"> ({durationHint})</span>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white/60 px-3 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Godzina rozpoczęcia
          </span>
          <div className="mt-2 flex justify-start">
            <TimePickerSelects idPrefix={`${id}-start`} timeStr={startTimeStr} setTimeStr={setStartTimeStr} />
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white/60 px-3 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Godzina zakończenia
          </span>
          <div className="mt-2 flex justify-start">
            <TimePickerSelects idPrefix={`${id}-end`} timeStr={endTimeStr} setTimeStr={setEndTimeStr} />
          </div>
        </div>
      </div>

      <input type="hidden" name="startsAt" value={startsCombined} />
      <input type="hidden" name="endsAt" value={endsCombined} />
    </fieldset>
  );
}

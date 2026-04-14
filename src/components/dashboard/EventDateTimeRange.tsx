"use client";

import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import {
  combineLocalDateAndTime,
  formatDdMmYyyyFromDate,
  formatDdMmYyyyInput,
  parseDdMmYyyy,
  startOfLocalDay,
  timestampToDdMmYyyyAndTime,
} from "@/lib/datetime-form";
import { TimePickerSelects } from "./TimePickerSelects";

import "react-day-picker/style.css";

type Props = {
  /** Unix ms — edit forms */
  defaultStartsAt?: number;
  defaultEndsAt?: number;
  /** Server-side validation message (e.g. range order). */
  error?: string;
};

export function EventDateTimeRange({ defaultStartsAt, defaultEndsAt, error }: Props) {
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

  const [startDateStr, setStartDateStr] = useState(() =>
    defaultStartsAt != null ? formatDdMmYyyyFromDate(startOfLocalDay(defaultStartsAt)) : "",
  );
  const [endDateStr, setEndDateStr] = useState(() =>
    defaultEndsAt != null ? formatDdMmYyyyFromDate(startOfLocalDay(defaultEndsAt)) : "",
  );
  const [manualDateError, setManualDateError] = useState<string | null>(null);

  function handleRangeSelect(sel: DateRange | undefined) {
    setManualDateError(null);
    setRange(sel);
    if (sel?.from) setStartDateStr(formatDdMmYyyyFromDate(sel.from));
    else setStartDateStr("");
    if (sel?.to) setEndDateStr(formatDdMmYyyyFromDate(sel.to));
    else setEndDateStr("");
  }

  function applyManualDates() {
    setManualDateError(null);
    const s = startDateStr.trim();
    const e = endDateStr.trim();
    if (!s && !e) {
      setRange(undefined);
      return;
    }
    if (!s) {
      return;
    }
    const fromParts = parseDdMmYyyy(s);
    if (!fromParts) {
      return;
    }
    const fromDate = new Date(fromParts.y, fromParts.m - 1, fromParts.d);
    if (!e) {
      setRange({ from: fromDate, to: undefined });
      return;
    }
    const toParts = parseDdMmYyyy(e);
    if (!toParts) {
      return;
    }
    const toDate = new Date(toParts.y, toParts.m - 1, toParts.d);
    if (toDate < fromDate) {
      setManualDateError("Data końca nie może być wcześniejsza niż początek.");
      setRange(undefined);
      return;
    }
    setRange({ from: fromDate, to: toDate });
  }

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
      el.setCustomValidity("Podaj datę początku i końca (kalendarz lub pola tekstowe).");
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
        Użyj kalendarza albo wpisz daty ręcznie (dd/mm/rrrr), potem ustaw godziny rozpoczęcia i zakończenia.
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">Data początku</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/rrrr"
            value={startDateStr}
            onChange={(e) => setStartDateStr(formatDdMmYyyyInput(e.target.value))}
            onBlur={applyManualDates}
            className="mt-1 w-full rounded-md border px-3 py-2 tabular-nums"
            aria-invalid={Boolean(manualDateError)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">Data końca</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/rrrr"
            value={endDateStr}
            onChange={(e) => setEndDateStr(formatDdMmYyyyInput(e.target.value))}
            onBlur={applyManualDates}
            className="mt-1 w-full rounded-md border px-3 py-2 tabular-nums"
            aria-invalid={Boolean(manualDateError)}
          />
        </label>
      </div>
      {manualDateError && (
        <p className="text-xs text-red-600" role="alert">
          {manualDateError}
        </p>
      )}

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
          onSelect={handleRangeSelect}
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

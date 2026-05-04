"use client";

import { useState } from "react";
import { DateTimePickerField } from "./DateTimePickerField";

type Props = {
  defaultStartsAt?: number;
  defaultEndsAt?: number;
  /** Server-side validation message (e.g. range order). */
  error?: string;
};

export function EventDateTimeFields({ defaultStartsAt, defaultEndsAt, error }: Props) {
  const [starts, setStarts] = useState<number | null>(defaultStartsAt ?? null);
  const [ends, setEnds] = useState<number | null>(defaultEndsAt ?? null);

  const durationHint =
    starts != null && ends != null && ends > starts ? formatDurationMs(ends - starts) : null;

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Termin wydarzenia</legend>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <DateTimePickerField
            name="startsAt"
            label="Początek"
            defaultValue={defaultStartsAt}
            defaultTime="09:00"
            required
            onChange={setStarts}
          />
        </div>
        <div className="flex-1">
          <DateTimePickerField
            name="endsAt"
            label="Koniec"
            defaultValue={defaultEndsAt}
            defaultTime="17:00"
            required
            onChange={setEnds}
          />
        </div>
      </div>
      {durationHint && (
        <p className="text-sm text-muted-foreground">Czas trwania: {durationHint}</p>
      )}
    </fieldset>
  );
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  const mins = totalMin - days * 60 * 24 - hours * 60;
  const parts: string[] = [];
  if (days > 0) parts.push(days === 1 ? "1 dzień" : `${days} dni`);
  if (hours > 0) parts.push(hours === 1 ? "1 godz." : `${hours} godz.`);
  if (mins > 0 && days === 0) parts.push(`${mins} min`);
  return parts.length === 0 ? "0 min" : parts.join(" ");
}

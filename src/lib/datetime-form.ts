/** Parse `dd/mm/yyyy` (day-first, Polish style). */
export function parseDdMmYyyy(s: string): { y: number; m: number; d: number } | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { y, m: mo, d };
}

/** `HH:mm` 24h */
export function parseTimeHm(s: string): { h: number; min: number } | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

export function toDatetimeLocalValue(
  date: { y: number; m: number; d: number },
  time: { h: number; min: number },
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.y}-${pad(date.m)}-${pad(date.d)}T${pad(time.h)}:${pad(time.min)}`;
}

export function timestampToDdMmYyyyAndTime(ts: number): { date: string; time: string } {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Auto-insert slashes while typing digits only. */
export function formatDdMmYyyyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function yyyyMmDdToDdMmYyyy(iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d)}/${pad(mo)}/${y}`;
}

/** Local calendar date from a `Date` (ignores time-of-day). */
export function localDateParts(d: Date): { y: number; m: number; d: number } {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

/** Display a local calendar date as `dd/mm/yyyy`. */
export function formatDdMmYyyyFromDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Midnight local time for a timestamp (for range calendar). */
export function startOfLocalDay(ts: number): Date {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Combine a local calendar date with `HH:mm` into `YYYY-MM-DDTHH:mm` for `FormData`. */
export function combineLocalDateAndTime(date: Date, timeStr: string): string | null {
  const t = parseTimeHm(timeStr);
  if (!t) return null;
  return toDatetimeLocalValue(localDateParts(date), t);
}

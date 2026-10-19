/**
 * Events happen in Poland and organizers type local times, but the Worker
 * runs in UTC. Everything that turns a typed time into a timestamp, or a
 * timestamp into text on the server, goes through Europe/Warsaw explicitly.
 */
export const APP_TIME_ZONE = "Europe/Warsaw";

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Offset of Warsaw from UTC at a given instant, in ms (e.g. +2h in summer). */
function warsawOffsetMs(utcMs: number): number {
  const parts: Record<string, number> = {};
  for (const p of offsetFormatter.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock time in Warsaw to a UTC timestamp. */
export function warsawWallTimeToUtc(y: number, m: number, d: number, h: number, min: number): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ts = guess - warsawOffsetMs(guess);
  // Around DST changes the offset at the result can differ from the guess.
  const corrected = guess - warsawOffsetMs(ts);
  if (corrected !== ts) ts = corrected;
  return ts;
}

/**
 * Parses a date-time posted by a form. Strings with an explicit zone (ISO
 * with Z or +hh:mm, as the creation wizard sends) are taken as is. A bare
 * `YYYY-MM-DDTHH:mm` (a datetime-local input) is Warsaw wall time.
 * Returns NaN when unparseable.
 */
export function parseFormDateTime(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;
  const local = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (local) {
    const [, y, mo, d, h, mi] = local.map(Number);
    return warsawWallTimeToUtc(y, mo, d, h, mi);
  }
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s).getTime();
  return NaN;
}

export function formatWarsawDate(
  ms: number,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  return new Date(ms).toLocaleDateString("pl-PL", { ...opts, timeZone: APP_TIME_ZONE });
}

export function formatWarsawDateTime(
  ms: number,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  return new Date(ms).toLocaleString("pl-PL", { ...opts, timeZone: APP_TIME_ZONE });
}

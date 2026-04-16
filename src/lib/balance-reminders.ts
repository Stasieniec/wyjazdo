const DAY = 86_400_000;
const HOUR = 3_600_000;

const WINDOWS = [
  { centerMsBeforeDue: 14 * DAY, halfWidthMs: 1 * DAY },
  { centerMsBeforeDue: 3 * DAY, halfWidthMs: 12 * HOUR },
  { centerMsBeforeDue: 0, halfWidthMs: 12 * HOUR },
];

export function shouldSendReminder(params: {
  nowMs: number;
  dueAtMs: number;
  lastReminderAt: number | null;
}): boolean {
  const { nowMs, dueAtMs, lastReminderAt } = params;
  const distance = dueAtMs - nowMs;
  const inWindow = WINDOWS.some(
    (w) => Math.abs(distance - w.centerMsBeforeDue) <= w.halfWidthMs,
  );
  if (!inWindow) return false;
  if (lastReminderAt != null && nowMs - lastReminderAt < 24 * HOUR) return false;
  return true;
}

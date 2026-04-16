import { describe, it, expect } from "vitest";
import { shouldSendReminder } from "./balance-reminders";

const DAY = 86_400_000;

describe("shouldSendReminder", () => {
  it("sends at T-14d window", () => {
    const due = 100 * DAY;
    const now = due - 14 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: null })).toBe(true);
  });
  it("sends at T-3d window", () => {
    const due = 100 * DAY;
    const now = due - 3 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: null })).toBe(true);
  });
  it("sends at T-0 window", () => {
    const due = 100 * DAY;
    const now = due - DAY / 4; // within ±12h
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: null })).toBe(true);
  });
  it("does not re-send when lastReminderAt is today", () => {
    const due = 100 * DAY;
    const now = due - 14 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: now - 60_000 })).toBe(false);
  });
  it("sends when lastReminderAt is yesterday", () => {
    const due = 100 * DAY;
    const now = due - 14 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: now - 25 * 60 * 60_000 })).toBe(true);
  });
  it("does not send outside the windows", () => {
    const due = 100 * DAY;
    const now = due - 10 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: null })).toBe(false);
  });
});

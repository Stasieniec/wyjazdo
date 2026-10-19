import { describe, it, expect } from "vitest";
import { parseFormDateTime, formatWarsawDate, formatWarsawDateTime } from "./timezone";

describe("parseFormDateTime", () => {
  it("reads a datetime-local value as Warsaw time in summer (UTC+2)", () => {
    expect(parseFormDateTime("2026-07-10T16:00")).toBe(Date.UTC(2026, 6, 10, 14, 0));
  });

  it("reads a datetime-local value as Warsaw time in winter (UTC+1)", () => {
    expect(parseFormDateTime("2026-12-04T16:00")).toBe(Date.UTC(2026, 11, 4, 15, 0));
  });

  it("handles the days DST changes", () => {
    // 2026-03-29 02:00 -> 03:00; 10:00 local is UTC+2.
    expect(parseFormDateTime("2026-03-29T10:00")).toBe(Date.UTC(2026, 2, 29, 8, 0));
    // 2026-10-25 03:00 -> 02:00; 10:00 local is UTC+1.
    expect(parseFormDateTime("2026-10-25T10:00")).toBe(Date.UTC(2026, 9, 25, 9, 0));
  });

  it("keeps ISO strings with a zone as they are (the wizard's format)", () => {
    expect(parseFormDateTime("2026-07-10T14:00:00.000Z")).toBe(Date.UTC(2026, 6, 10, 14, 0));
    expect(parseFormDateTime("2026-07-10T16:00+02:00")).toBe(Date.UTC(2026, 6, 10, 14, 0));
  });

  it("returns NaN for garbage", () => {
    expect(parseFormDateTime("")).toBeNaN();
    expect(parseFormDateTime("tomorrow")).toBeNaN();
  });

  it("round-trips: what the organizer types is what is shown", () => {
    const ts = parseFormDateTime("2026-11-13T17:30");
    expect(formatWarsawDateTime(ts, { hour: "2-digit", minute: "2-digit" })).toBe("17:30");
    expect(formatWarsawDate(ts)).toBe("13 listopada 2026");
  });

  it("formats a late-evening UTC instant on the Warsaw calendar day", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Warsaw.
    expect(formatWarsawDate(Date.UTC(2026, 11, 31, 23, 30))).toBe("1 stycznia 2027");
  });
});

import { describe, expect, it } from "vitest";
import {
  combineLocalDateAndTime,
  formatDdMmYyyyFromDate,
  formatDdMmYyyyInput,
  parseDdMmYyyy,
  parseTimeHm,
  timestampToDdMmYyyyAndTime,
  toDatetimeLocalValue,
  yyyyMmDdToDdMmYyyy,
} from "./datetime-form";

describe("parseDdMmYyyy", () => {
  it("parses valid dates", () => {
    expect(parseDdMmYyyy("14/04/2026")).toEqual({ d: 14, m: 4, y: 2026 });
    expect(parseDdMmYyyy("01/01/2025")).toEqual({ d: 1, m: 1, y: 2025 });
  });
  it("rejects invalid calendar days", () => {
    expect(parseDdMmYyyy("31/02/2026")).toBeNull();
    expect(parseDdMmYyyy("32/01/2026")).toBeNull();
  });
});

describe("parseTimeHm", () => {
  it("parses 24h times", () => {
    expect(parseTimeHm("09:30")).toEqual({ h: 9, min: 30 });
    expect(parseTimeHm("23:59")).toEqual({ h: 23, min: 59 });
  });
  it("rejects bad times", () => {
    expect(parseTimeHm("24:00")).toBeNull();
    expect(parseTimeHm("12:60")).toBeNull();
  });
});

describe("toDatetimeLocalValue", () => {
  it("builds local datetime string for form", () => {
    expect(toDatetimeLocalValue({ d: 5, m: 12, y: 2026 }, { h: 8, min: 5 })).toBe("2026-12-05T08:05");
  });
});

describe("formatDdMmYyyyInput", () => {
  it("inserts slashes", () => {
    expect(formatDdMmYyyyInput("14042026")).toBe("14/04/2026");
  });
});

describe("yyyyMmDdToDdMmYyyy", () => {
  it("converts", () => {
    expect(yyyyMmDdToDdMmYyyy("2026-04-14")).toBe("14/04/2026");
  });
});

describe("timestampToDdMmYyyyAndTime", () => {
  it("uses local timezone", () => {
    const ts = new Date(2026, 3, 14, 15, 30, 0).getTime();
    expect(timestampToDdMmYyyyAndTime(ts)).toEqual({ date: "14/04/2026", time: "15:30" });
  });
});

describe("combineLocalDateAndTime", () => {
  it("joins local date and HH:mm", () => {
    const d = new Date(2026, 3, 14);
    expect(combineLocalDateAndTime(d, "09:05")).toBe("2026-04-14T09:05");
  });
});

describe("formatDdMmYyyyFromDate", () => {
  it("formats local date", () => {
    expect(formatDdMmYyyyFromDate(new Date(2026, 3, 5))).toBe("05/04/2026");
  });
});

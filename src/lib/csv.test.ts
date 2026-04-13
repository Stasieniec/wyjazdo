import { describe, it, expect } from "vitest";
import { toCsvRow } from "./csv";

describe("toCsvRow", () => {
  it("joins simple fields with commas", () => {
    expect(toCsvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("quotes fields containing commas", () => {
    expect(toCsvRow(["a,b", "c"])).toBe('"a,b",c');
  });

  it("escapes embedded quotes by doubling them", () => {
    expect(toCsvRow(['she said "hi"'])).toBe('"she said ""hi"""');
  });

  it("quotes fields containing newlines", () => {
    expect(toCsvRow(["line1\nline2"])).toBe('"line1\nline2"');
  });

  it("converts null/undefined to empty string", () => {
    expect(toCsvRow([null, undefined, "x"])).toBe(",,x");
  });

  it("converts numbers to strings", () => {
    expect(toCsvRow([1, 2.5])).toBe("1,2.5");
  });
});

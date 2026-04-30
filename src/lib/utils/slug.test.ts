import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases ASCII", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips Polish diacritics via NFD", () => {
    expect(slugify("Górskie Wyjazdy")).toBe("gorskie-wyjazdy");
    expect(slugify("Anna Lęcka — Retreaty")).toBe("anna-lecka-retreaty");
  });

  it("maps ł and Ł to l (NFD does not handle these)", () => {
    expect(slugify("Łódź")).toBe("lodz");
    expect(slugify("Anna Łęcka")).toBe("anna-lecka");
  });

  it("collapses runs of non-alphanumerics to a single dash", () => {
    expect(slugify("Mountain & Soul!!! 2024")).toBe("mountain-soul-2024");
    expect(slugify("a   b")).toBe("a-b");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("---hello---")).toBe("hello");
    expect(slugify("  spaced  ")).toBe("spaced");
  });

  it("returns an empty string for empty / dash-only / emoji-only input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
    expect(slugify("---")).toBe("");
    expect(slugify("🎉🌄")).toBe("");
  });

  it("truncates to 32 chars at a dash boundary when possible", () => {
    // 38 chars after slugify; nearest dash before 32 should win.
    const result = slugify("Anna Lecka Retreaty Gorskie Wyjazdy 2024");
    expect(result.length).toBeLessThanOrEqual(32);
    expect(result.endsWith("-")).toBe(false);
    expect(result).toBe("anna-lecka-retreaty-gorskie");
  });

  it("hard-cuts at 32 if no dash boundary is available", () => {
    const result = slugify("a".repeat(40));
    expect(result.length).toBe(32);
    expect(result).toBe("a".repeat(32));
  });

  it("preserves digits", () => {
    expect(slugify("Wyjazd 2024")).toBe("wyjazd-2024");
  });
});

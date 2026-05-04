import { describe, expect, it } from "vitest";
import {
  ALL_STEP_IDS,
  STEP_LABELS,
  isFreeFromAttendeeTypes,
  visibleStepsFor,
  nextStepId,
  prevStepId,
  isStepIdValid,
  type StepId,
} from "./event-creation-steps";
import type { AttendeeType } from "@/lib/validators/attendee-types";

const paid: AttendeeType[] = [
  { id: "a1", name: "Uczestnik", priceCents: 5000, minQty: 1, maxQty: 1 },
];
const free: AttendeeType[] = [
  { id: "a1", name: "Uczestnik", priceCents: 0, minQty: 1, maxQty: 1 },
];
const mixedFree: AttendeeType[] = [
  { id: "a1", name: "Rodzic", priceCents: 0, minQty: 1, maxQty: 1 },
  { id: "a2", name: "Dziecko", priceCents: 0, minQty: 0, maxQty: 4 },
];

describe("ALL_STEP_IDS", () => {
  it("has 10 ids in canonical order", () => {
    expect(ALL_STEP_IDS).toEqual([
      "tytul",
      "opis",
      "termin",
      "miejsce",
      "uczestnicy",
      "miejsca",
      "platnosc",
      "zdjecia",
      "pytania",
      "zgody",
    ]);
  });
});

describe("isFreeFromAttendeeTypes", () => {
  it("treats null/empty as free", () => {
    expect(isFreeFromAttendeeTypes(null)).toBe(true);
    expect(isFreeFromAttendeeTypes([])).toBe(true);
  });
  it("returns true when every type has priceCents 0", () => {
    expect(isFreeFromAttendeeTypes(free)).toBe(true);
    expect(isFreeFromAttendeeTypes(mixedFree)).toBe(true);
  });
  it("returns false when any type has priceCents > 0", () => {
    expect(isFreeFromAttendeeTypes(paid)).toBe(false);
  });
});

describe("visibleStepsFor", () => {
  it("returns all 10 steps for paid events", () => {
    expect(visibleStepsFor(paid)).toHaveLength(10);
    expect(visibleStepsFor(paid)).toContain("platnosc");
  });
  it("omits 'platnosc' for free events", () => {
    const visible = visibleStepsFor(free);
    expect(visible).toHaveLength(9);
    expect(visible).not.toContain("platnosc");
  });
});

describe("nextStepId", () => {
  it("returns next visible step", () => {
    expect(nextStepId("tytul", paid)).toBe("opis");
    expect(nextStepId("miejsca", paid)).toBe("platnosc");
    expect(nextStepId("miejsca", free)).toBe("zdjecia"); // skips platnosc
  });
  it("returns null after the last step", () => {
    expect(nextStepId("zgody", paid)).toBeNull();
    expect(nextStepId("zgody", free)).toBeNull();
  });
});

describe("prevStepId", () => {
  it("returns previous visible step", () => {
    expect(prevStepId("opis", paid)).toBe("tytul");
    expect(prevStepId("zdjecia", paid)).toBe("platnosc");
    expect(prevStepId("zdjecia", free)).toBe("miejsca"); // skips platnosc
  });
  it("returns null before the first step", () => {
    expect(prevStepId("tytul", paid)).toBeNull();
  });
});

describe("isStepIdValid", () => {
  it("returns true for canonical ids", () => {
    expect(isStepIdValid("tytul")).toBe(true);
    expect(isStepIdValid("zgody")).toBe(true);
  });
  it("returns false for unknown strings", () => {
    expect(isStepIdValid("xxx")).toBe(false);
    expect(isStepIdValid("")).toBe(false);
    expect(isStepIdValid(null)).toBe(false);
  });
  it("returns false for the 'complete' sentinel (which is not a step)", () => {
    expect(isStepIdValid("complete")).toBe(false);
  });
});

describe("STEP_LABELS", () => {
  it("provides a Polish label for each step id", () => {
    for (const id of ALL_STEP_IDS) {
      expect(STEP_LABELS[id as StepId]).toBeTruthy();
    }
  });
});

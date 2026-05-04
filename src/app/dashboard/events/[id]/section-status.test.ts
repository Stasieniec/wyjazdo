import { describe, expect, it } from "vitest";
import { computeSectionStatus, isPublishable } from "./section-status";

const validBase = {
  title: "Wydarzenie",
  slug: "wydarzenie",
  description: null,
  location: null,
  startsAt: 100,
  endsAt: 200,
  capacity: 10,
  attendeeTypes: JSON.stringify([{ id: "a", name: "Osoba", priceCents: 100, minQty: 1, maxQty: 1 }]),
  depositCents: null,
  balanceDueAt: null,
  coverUrl: null,
  customQuestions: JSON.stringify([]),
  consentConfig: JSON.stringify([]),
};

describe("computeSectionStatus", () => {
  it("flags required sections as filled when valid", () => {
    const s = computeSectionStatus(validBase, []);
    expect(s.podstawy).toBe("filled");
    expect(s.termin).toBe("filled");
    expect(s.uczestnicy).toBe("filled");
    expect(s.miejsca).toBe("filled");
  });
  it("flags optional sections as empty when missing", () => {
    const s = computeSectionStatus(validBase, []);
    expect(s.miejsce).toBe("empty");
    expect(s.zdjecia).toBe("empty");
    expect(s.pytania).toBe("empty");
  });
  it("flags Płatność as 'free' when no price", () => {
    const ev = { ...validBase, attendeeTypes: JSON.stringify([{ id: "a", name: "Osoba", priceCents: 0, minQty: 1, maxQty: 1 }]) };
    const s = computeSectionStatus(ev, []);
    expect(s.platnosc).toBe("free");
  });
});

describe("isPublishable", () => {
  it("returns true for a complete event", () => {
    expect(isPublishable(validBase, []).ok).toBe(true);
  });
  it("returns missing fields", () => {
    const r = isPublishable({ ...validBase, capacity: 0 }, []);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected ok=false");
    expect(r.missing).toContain("capacity");
  });
});

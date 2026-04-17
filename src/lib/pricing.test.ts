import { describe, it, expect } from "vitest";
import { calculateTotal } from "./pricing";
import type { AttendeeType } from "./validators/attendee-types";

const parent: AttendeeType = {
  id: "rodzic",
  name: "Rodzic",
  minQty: 1,
  maxQty: 1,
  priceCents: 20000,
};

const child: AttendeeType = {
  id: "dziecko",
  name: "Dziecko",
  minQty: 1,
  maxQty: 5,
  priceCents: 10000,
  graduatedPricing: [{ fromQty: 2, priceCents: 8000 }],
};

describe("calculateTotal", () => {
  it("returns 0 when no attendees", () => {
    expect(calculateTotal([parent, child], {}).total).toBe(0);
  });

  it("applies base price when no graduated tier matches", () => {
    const r = calculateTotal([parent, child], { rodzic: 1, dziecko: 1 });
    expect(r.total).toBe(30000); // 200 + 100
    expect(r.perType).toEqual([
      { typeId: "rodzic", subtotal: 20000, breakdown: [{ position: 1, priceCents: 20000 }] },
      { typeId: "dziecko", subtotal: 10000, breakdown: [{ position: 1, priceCents: 10000 }] },
    ]);
  });

  it("applies graduated tier from the nth attendee onwards", () => {
    // 1 parent + 3 children: 200 + 100 + 80 + 80 = 460
    const r = calculateTotal([parent, child], { rodzic: 1, dziecko: 3 });
    expect(r.total).toBe(46000);
  });

  it("picks the highest matching tier when multiple tiers exist", () => {
    const t: AttendeeType = {
      id: "t",
      name: "T",
      minQty: 1,
      maxQty: 10,
      priceCents: 10000,
      graduatedPricing: [
        { fromQty: 2, priceCents: 8000 },
        { fromQty: 4, priceCents: 6000 },
      ],
    };
    // positions 1..5 → 100, 80, 80, 60, 60 = 380
    expect(calculateTotal([t], { t: 5 }).total).toBe(38000);
  });

  it("ignores types not referenced in quantities", () => {
    expect(calculateTotal([parent, child], { rodzic: 1 }).total).toBe(20000);
  });

  it("ignores unknown typeIds in quantities", () => {
    expect(calculateTotal([parent], { rodzic: 1, zombie: 3 }).total).toBe(20000);
  });
});

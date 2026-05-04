import { describe, it, expect } from "vitest";
import { buildPresetTypes, PRESET_IDS, PRESET_LABELS } from "./attendee-presets";

describe("buildPresetTypes", () => {
  it("jedna_osoba: single type, qty 1..1, uses provided base price", () => {
    const types = buildPresetTypes("jedna_osoba", { basePriceCents: 15000 });
    expect(types).toHaveLength(1);
    expect(types[0]).toMatchObject({
      name: "Uczestnik",
      minQty: 1,
      maxQty: 1,
      priceCents: 15000,
    });
    expect(typeof types[0].id).toBe("string");
    expect(types[0].id.length).toBeGreaterThan(0);
  });

  it("rodzic_z_dziecmi: parent + child types with child preset having Wiek field", () => {
    const types = buildPresetTypes("rodzic_z_dziecmi", { basePriceCents: 0 });
    expect(types).toHaveLength(2);
    const parent = types.find((t) => t.name === "Rodzic")!;
    const child = types.find((t) => t.name === "Dziecko")!;
    expect(parent).toMatchObject({ minQty: 1, maxQty: 1 });
    expect(child).toMatchObject({ minQty: 1, maxQty: 5 });
    expect(child.customFields?.some((f) => f.label === "Wiek")).toBe(true);
  });

  it("grupa: single type with qty 1..10", () => {
    const types = buildPresetTypes("grupa", { basePriceCents: 0 });
    expect(types).toHaveLength(1);
    expect(types[0]).toMatchObject({ minQty: 1, maxQty: 10, name: "Uczestnik" });
  });

  it("exports a list of preset ids", () => {
    expect(PRESET_IDS).toEqual(["jedna_osoba", "rodzic_z_dziecmi", "grupa"]);
  });
});

describe("PRESET_LABELS (rewritten copy)", () => {
  it("uses 'Tylko siebie' for jedna_osoba", () => {
    expect(PRESET_LABELS.jedna_osoba.title).toBe("Tylko siebie");
    expect(PRESET_LABELS.jedna_osoba.description).toContain("tylko siebie");
  });

  it("keeps 'Rodzic z dziećmi' for rodzic_z_dziecmi", () => {
    expect(PRESET_LABELS.rodzic_z_dziecmi.title).toBe("Rodzic z dziećmi");
    expect(PRESET_LABELS.rodzic_z_dziecmi.description).toContain("dzieci");
  });

  it("uses 'Grupa (kilka osób na raz)' for grupa", () => {
    expect(PRESET_LABELS.grupa.title).toBe("Grupa (kilka osób na raz)");
    expect(PRESET_LABELS.grupa.description).toContain("siebie i znajomych");
  });
});

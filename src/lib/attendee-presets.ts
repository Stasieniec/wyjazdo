import { newId } from "./ids";
import type { AttendeeType } from "./validators/attendee-types";

export const PRESET_IDS = ["jedna_osoba", "rodzic_z_dziecmi", "grupa"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export type PresetContext = {
  basePriceCents: number;
};

export function buildPresetTypes(preset: PresetId, ctx: PresetContext): AttendeeType[] {
  if (preset === "jedna_osoba") {
    return [
      {
        id: newId(),
        name: "Uczestnik",
        minQty: 1,
        maxQty: 1,
        priceCents: ctx.basePriceCents,
      },
    ];
  }
  if (preset === "rodzic_z_dziecmi") {
    return [
      {
        id: newId(),
        name: "Rodzic",
        minQty: 1,
        maxQty: 1,
        priceCents: 0,
      },
      {
        id: newId(),
        name: "Dziecko",
        minQty: 1,
        maxQty: 5,
        priceCents: 0,
        customFields: [
          { id: newId(), label: "Wiek", type: "number", required: true },
        ],
      },
    ];
  }
  // grupa
  return [
    {
      id: newId(),
      name: "Uczestnik",
      minQty: 1,
      maxQty: 10,
      priceCents: ctx.basePriceCents,
    },
  ];
}

export const PRESET_LABELS: Record<PresetId, { title: string; description: string }> = {
  jedna_osoba: {
    title: "Jedna osoba",
    description: "Standardowa rejestracja, jedna osoba na zgłoszenie.",
  },
  rodzic_z_dziecmi: {
    title: "Rodzic z dziećmi",
    description: "Rodzic zapisuje siebie i swoje dzieci.",
  },
  grupa: {
    title: "Grupa / zespół",
    description: "Jedna osoba zapisuje kilku uczestników.",
  },
};

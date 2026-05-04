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
    title: "Tylko siebie",
    description:
      "Każda osoba zapisuje tylko siebie. Jedno zgłoszenie = jedna osoba. Najprostsze.",
  },
  rodzic_z_dziecmi: {
    title: "Rodzic z dziećmi",
    description:
      "Rodzic zapisuje siebie i swoje dzieci w jednym zgłoszeniu. Możesz mieć inną cenę dla dziecka i pytać o każde dziecko osobno (wiek, alergie).",
  },
  grupa: {
    title: "Grupa (kilka osób na raz)",
    description:
      "Jedna osoba zapisuje siebie i znajomych w jednym zgłoszeniu — np. razem z koleżanką albo całym zespołem. Ty ustalasz, ile osób maksymalnie może być w jednym zgłoszeniu.",
  },
};

import type { AttendeeType } from "@/lib/validators/attendee-types";

export const ALL_STEP_IDS = [
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
] as const;
export type StepId = (typeof ALL_STEP_IDS)[number];

export const STEP_LABELS: Record<StepId, string> = {
  tytul: "Tytuł",
  opis: "Opis",
  termin: "Termin",
  miejsce: "Miejsce",
  uczestnicy: "Uczestnicy",
  miejsca: "Liczba miejsc",
  platnosc: "Płatność",
  zdjecia: "Zdjęcia",
  pytania: "Pytania",
  zgody: "Zgody",
};

export function isFreeFromAttendeeTypes(types: AttendeeType[] | null): boolean {
  if (!types || types.length === 0) return true;
  return types.every((t) => t.priceCents === 0);
}

export function visibleStepsFor(types: AttendeeType[] | null): StepId[] {
  const free = isFreeFromAttendeeTypes(types);
  return ALL_STEP_IDS.filter((id) => !(free && id === "platnosc"));
}

export function nextStepId(current: StepId, types: AttendeeType[] | null): StepId | null {
  const visible = visibleStepsFor(types);
  const idx = visible.indexOf(current);
  if (idx === -1 || idx >= visible.length - 1) return null;
  return visible[idx + 1];
}

export function prevStepId(current: StepId, types: AttendeeType[] | null): StepId | null {
  const visible = visibleStepsFor(types);
  const idx = visible.indexOf(current);
  if (idx <= 0) return null;
  return visible[idx - 1];
}

export function isStepIdValid(id: unknown): id is StepId {
  return typeof id === "string" && (ALL_STEP_IDS as readonly string[]).includes(id);
}

// RODO art. 9 hint detector for organizer-built question labels.
// Heuristic only — non-blocking warning meant to nudge organizers away
// from collecting special-category data without proper basis + explicit consent.

export type SpecialCategoryKind = "health" | "religion" | "ethnicity" | "sexual" | "political" | "union";

const HEALTH = [
  "alergi", "uczul", "diet", "nietolerancj", "zdrow", "lek ", "leki", "leku",
  "leczeni", "lekarz", "choro", "schor", "ciaz", "ciąż", "niepelnospraw",
  "niepełnospraw", "rehabilit", "fizjoterap", "depres", "psych", "lęk", "lek.",
  "waga (med)", "diagnoz", "objaw", "szczepi",
];

const RELIGION = [
  "religi", "wyzn", "wiar", "kosciol", "kościół", "parafii", "modlit",
  "halal", "koszer",
];

const ETHNICITY = [
  "narodow", "pochodzeni etn", "rasa ", "etniczn",
];

const SEXUAL = [
  "orientacj", "homosek", "biseksual", "transp", "lgbt",
];

const POLITICAL = [
  "polityczn", "partia", "wybory", "głosow", "glosow",
];

const UNION = [
  "związkow", "zwiazkow", "związek zawod", "zwiazek zawod",
];

const TABLE: Array<{ kind: SpecialCategoryKind; needles: string[] }> = [
  { kind: "health", needles: HEALTH },
  { kind: "religion", needles: RELIGION },
  { kind: "ethnicity", needles: ETHNICITY },
  { kind: "sexual", needles: SEXUAL },
  { kind: "political", needles: POLITICAL },
  { kind: "union", needles: UNION },
];

export function detectSpecialCategoryHint(label: string): SpecialCategoryKind | null {
  const normalised = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  for (const { kind, needles } of TABLE) {
    for (const needle of needles) {
      const n = needle.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
      if (normalised.includes(n)) return kind;
    }
  }
  return null;
}

export function specialCategoryWarning(kind: SpecialCategoryKind): string {
  const what: Record<SpecialCategoryKind, string> = {
    health: "zdrowia (np. alergie, dieta, choroby)",
    religion: "przekonań religijnych lub światopoglądowych",
    ethnicity: "pochodzenia rasowego lub etnicznego",
    sexual: "życia seksualnego lub orientacji",
    political: "poglądów politycznych",
    union: "przynależności do związków zawodowych",
  };
  return `To pytanie dotyczy ${what[kind]}. Pamiętaj, żeby dodać odpowiednią zgodę RODO w kroku „Zgody i regulaminy".`;
}

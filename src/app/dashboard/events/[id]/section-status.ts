import type { AttendeeType } from "@/lib/validators/attendee-types";

export type SectionId =
  | "podstawy"
  | "termin"
  | "miejsce"
  | "uczestnicy"
  | "miejsca"
  | "platnosc"
  | "zdjecia"
  | "pytania"
  | "zgody";

export type SectionStatus = "filled" | "empty" | "free";

export type EventForStatus = {
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  startsAt: number;
  endsAt: number;
  capacity: number;
  attendeeTypes: string | null;
  depositCents: number | null;
  balanceDueAt: number | null;
  coverUrl: string | null;
  customQuestions: string | null;
  consentConfig: string | null;
};

function attendeeTypesArray(json: string | null): AttendeeType[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export function computeSectionStatus(
  ev: EventForStatus,
  galleryPhotos: { url: string }[],
): Record<SectionId, SectionStatus> {
  const types = attendeeTypesArray(ev.attendeeTypes);
  const isFree = !types || types.every((t) => t.priceCents === 0);
  const customQuestions = ev.customQuestions ? safeParseArray(ev.customQuestions) : [];
  const perAttendeeQuestions =
    (types ?? []).reduce((sum, t) => sum + (t.customFields?.length ?? 0), 0) > 0;
  const consents = ev.consentConfig ? safeParseArray(ev.consentConfig) : [];

  return {
    podstawy: ev.title.length > 0 && ev.slug.length > 0 ? "filled" : "empty",
    termin: ev.startsAt > 0 && ev.endsAt > ev.startsAt ? "filled" : "empty",
    miejsce: ev.location && ev.location.length > 0 ? "filled" : "empty",
    uczestnicy: types && types.length > 0 ? "filled" : "empty",
    miejsca: ev.capacity >= 1 ? "filled" : "empty",
    platnosc: isFree ? "free" : ev.depositCents != null && ev.balanceDueAt != null ? "filled" : "empty",
    zdjecia: ev.coverUrl || galleryPhotos.length > 0 ? "filled" : "empty",
    pytania: customQuestions.length > 0 || perAttendeeQuestions ? "filled" : "empty",
    zgody: consents.length > 0 ? "filled" : "empty",
  };
}

export type PublishCheck =
  | { ok: true }
  | { ok: false; missing: string[] };

export function isPublishable(
  ev: EventForStatus,
  galleryPhotos: { url: string }[],
): PublishCheck {
  void galleryPhotos; // not part of publishability — kept in signature for symmetry
  const missing: string[] = [];
  if (!ev.title || ev.title.length === 0) missing.push("title");
  if (!ev.slug || ev.slug.length < 3) missing.push("slug");
  if (!(ev.startsAt > 0 && ev.endsAt > ev.startsAt)) missing.push("startsAt/endsAt");
  if (ev.capacity < 1) missing.push("capacity");
  const types = attendeeTypesArray(ev.attendeeTypes);
  if (!types || types.length === 0) missing.push("attendeeTypes");
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

function safeParseArray(s: string): unknown[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

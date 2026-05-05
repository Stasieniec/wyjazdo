"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { newId } from "@/lib/ids";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import {
  getEventForOrganizer,
  insertEvent,
  isSlugTakenForOrganizer,
  updateEvent,
} from "@/lib/db/queries/events-dashboard";
import { replacePhotosForEvent } from "@/lib/db/queries/event-photos";
import {
  stepTitleSchema,
  stepDescriptionSchema,
  stepDatesSchema,
  stepLocationSchema,
  stepCapacitySchema,
  stepPaymentSchema,
} from "@/lib/validators/event-wizard";
import {
  attendeeTypesSchema,
  type AttendeeType,
} from "@/lib/validators/attendee-types";
import { customQuestionSchema } from "@/lib/validators/event";
import { consentConfigSchema } from "@/lib/validators/consent";
import { z } from "zod";
import { isStepIdValid, nextStepId, visibleStepsFor, type StepId } from "@/lib/wizard/event-creation-steps";

export type StepResult =
  | { ok: true; eventId: string; nextStep: StepId | "complete" }
  | { errors: Record<string, string>; values: Record<string, string> };

async function requireOrganizer() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  return organizer;
}

async function requireOwnedDraft(organizerId: string, eventId: string) {
  const ev = await getEventForOrganizer(organizerId, eventId);
  if (!ev) throw new Error("Not found");
  if (ev.status === "published" || ev.status === "archived") {
    throw new Error("Event no longer in wizard");
  }
  return ev;
}

function loadAttendeeTypes(json: string | null): AttendeeType[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as AttendeeType[]) : null;
  } catch {
    return null;
  }
}

function pricesFromTypes(types: AttendeeType[] | null): number {
  if (!types || types.length === 0) return 0;
  return types.reduce((m, t) => Math.max(m, t.priceCents), 0);
}

// Forward-only watermark: only advance creationStep when `next` is later than what's already saved.
// Editing an earlier step must not regress the watermark.
function advanceCreationStep(
  saved: string | null,
  next: StepId | "complete",
  types: AttendeeType[] | null,
): StepId | "complete" {
  if (saved === "complete") return "complete";
  if (next === "complete") return "complete";
  if (saved == null || !isStepIdValid(saved)) return next;
  const visible = visibleStepsFor(types);
  const savedIdx = visible.indexOf(saved as StepId);
  const nextIdx = visible.indexOf(next);
  if (savedIdx === -1) return next;
  return nextIdx > savedIdx ? next : (saved as StepId);
}

// ---------- Step 1: Title (creates the row on first call) ----------

export async function saveStepTitleAction(
  eventId: string | null,
  formData: FormData,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const parsed = stepTitleSchema.safeParse({ title, slug });
  if (!parsed.success) {
    return {
      errors: zodIssues(parsed.error.issues),
      values: { title, slug },
    };
  }

  if (eventId == null) {
    if (await isSlugTakenForOrganizer(organizer.id, parsed.data.slug)) {
      return {
        errors: { slug: "Ta nazwa w URL jest już zajęta" },
        values: { title, slug },
      };
    }
    const id = newId();
    const now = Date.now();
    await insertEvent({
      id,
      organizerId: organizer.id,
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: null,
      location: null,
      startsAt: 0,
      endsAt: 0,
      priceCents: 0,
      currency: "PLN",
      capacity: 1,
      coverUrl: null,
      status: "draft",
      customQuestions: JSON.stringify([]),
      attendeeTypes: null,
      depositCents: null,
      balanceDueAt: null,
      consentConfig: null,
      createdAt: now,
      updatedAt: now,
      creationStep: "opis",
      publishedAt: null,
    });
    return { ok: true, eventId: id, nextStep: "opis" };
  }

  const ev = await requireOwnedDraft(organizer.id, eventId);
  // Re-check slug uniqueness only if slug changed
  if (parsed.data.slug !== ev.slug) {
    if (await isSlugTakenForOrganizer(organizer.id, parsed.data.slug)) {
      return {
        errors: { slug: "Ta nazwa w URL jest już zajęta" },
        values: { title, slug },
      };
    }
  }
  const titleTypes = loadAttendeeTypes(ev.attendeeTypes);
  const titleNext = nextStepId("tytul", titleTypes) ?? "opis";
  await updateEvent(organizer.id, eventId, {
    title: parsed.data.title,
    slug: parsed.data.slug,
    creationStep: advanceCreationStep(ev.creationStep, titleNext, titleTypes),
  });
  return { ok: true, eventId, nextStep: "opis" };
}

// ---------- Step 2: Description ----------

export async function saveStepDescriptionAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const description = String(formData.get("description") ?? "");
  if (!skip) {
    const parsed = stepDescriptionSchema.safeParse({ description });
    if (!parsed.success) {
      return {
        errors: zodIssues(parsed.error.issues),
        values: { description },
      };
    }
  }
  const descTypes = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("opis", descTypes) ?? "termin";
  await updateEvent(organizer.id, eventId, {
    description: skip ? ev.description : description.trim() || null,
    creationStep: advanceCreationStep(ev.creationStep, next, descTypes),
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 3: Dates ----------

export async function saveStepDatesAction(
  eventId: string,
  formData: FormData,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const startsRaw = String(formData.get("startsAt") ?? "");
  const endsRaw = String(formData.get("endsAt") ?? "");
  const startsAt = startsRaw ? new Date(startsRaw).getTime() : NaN;
  const endsAt = endsRaw ? new Date(endsRaw).getTime() : NaN;
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return {
      errors: { startsAt: "Wybierz początek i koniec.", endsAt: "Wybierz początek i koniec." },
      values: { startsAt: startsRaw, endsAt: endsRaw },
    };
  }
  const parsed = stepDatesSchema.safeParse({ startsAt, endsAt });
  if (!parsed.success) {
    return {
      errors: zodIssues(parsed.error.issues),
      values: { startsAt: startsRaw, endsAt: endsRaw },
    };
  }
  const datesTypes = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("termin", datesTypes) ?? "miejsce";
  await updateEvent(organizer.id, eventId, {
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    creationStep: advanceCreationStep(ev.creationStep, next, datesTypes),
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 4: Location ----------

export async function saveStepLocationAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const location = String(formData.get("location") ?? "");
  if (!skip) {
    const parsed = stepLocationSchema.safeParse({ location });
    if (!parsed.success) {
      return {
        errors: zodIssues(parsed.error.issues),
        values: { location },
      };
    }
  }
  const locTypes = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("miejsce", locTypes) ?? "uczestnicy";
  await updateEvent(organizer.id, eventId, {
    location: skip ? ev.location : location.trim() || null,
    creationStep: advanceCreationStep(ev.creationStep, next, locTypes),
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 5: Attendees + per-type prices ----------

export async function saveStepAttendeesAction(
  eventId: string,
  formData: FormData,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const raw = String(formData.get("attendeeTypes") ?? "");
  if (!raw.trim()) {
    return {
      errors: { attendeeTypes: "Wybierz szablon i ustaw cenę." },
      values: { attendeeTypes: raw },
    };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return {
      errors: { attendeeTypes: "Niepoprawna konfiguracja typów uczestników." },
      values: { attendeeTypes: raw },
    };
  }
  const parsed = attendeeTypesSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      errors: { attendeeTypes: "Niepoprawna konfiguracja typów uczestników." },
      values: { attendeeTypes: raw },
    };
  }
  const types = parsed.data as AttendeeType[];
  const priceCents = pricesFromTypes(types);
  const next = nextStepId("uczestnicy", types) ?? "miejsca";
  await updateEvent(organizer.id, eventId, {
    attendeeTypes: JSON.stringify(types),
    priceCents,
    creationStep: advanceCreationStep(ev.creationStep, next, types),
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 6: Capacity ----------

export async function saveStepCapacityAction(
  eventId: string,
  formData: FormData,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const capacityRaw = String(formData.get("capacity") ?? "");
  const capacity = Number(capacityRaw);
  const parsed = stepCapacitySchema.safeParse({ capacity });
  if (!parsed.success) {
    return {
      errors: zodIssues(parsed.error.issues),
      values: { capacity: capacityRaw },
    };
  }
  const types = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("miejsca", types) ?? "platnosc";
  await updateEvent(organizer.id, eventId, {
    capacity: parsed.data.capacity,
    creationStep: advanceCreationStep(ev.creationStep, next, types),
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 7: Payment ----------

export async function saveStepPaymentAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const types = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("platnosc", types) ?? "zdjecia";

  if (skip) {
    await updateEvent(organizer.id, eventId, {
      depositCents: null,
      balanceDueAt: null,
      creationStep: advanceCreationStep(ev.creationStep, next, types),
    });
    return { ok: true, eventId, nextStep: next };
  }

  const depositOn = formData.get("depositOn") === "on" || formData.get("depositOn") === "true";
  const depositRaw = String(formData.get("deposit") ?? "");
  const balanceDueRaw = String(formData.get("balanceDueAt") ?? "");
  const depositCents = depositRaw ? Math.round(Number(depositRaw) * 100) : null;
  const balanceDueAt = balanceDueRaw ? new Date(balanceDueRaw).getTime() : null;

  const parsed = stepPaymentSchema.safeParse({ depositOn, depositCents, balanceDueAt });
  if (!parsed.success) {
    return {
      errors: zodIssues(parsed.error.issues),
      values: { deposit: depositRaw, balanceDueAt: balanceDueRaw, depositOn: depositOn ? "true" : "" },
    };
  }
  await updateEvent(organizer.id, eventId, {
    depositCents: depositOn ? depositCents : null,
    balanceDueAt: depositOn ? balanceDueAt : null,
    creationStep: advanceCreationStep(ev.creationStep, next, types),
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 8: Photos (cover + gallery) ----------

export async function saveStepPhotosAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const types = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("zdjecia", types) ?? "pytania";
  if (skip) {
    await updateEvent(organizer.id, eventId, {
      creationStep: advanceCreationStep(ev.creationStep, next, types),
    });
    return { ok: true, eventId, nextStep: next };
  }
  const coverUrl = String(formData.get("coverUrl") ?? "");
  const galleryRaw = String(formData.get("galleryPhotos") ?? "[]");
  let gallery: { url: string; position: number }[] = [];
  try {
    const arr = JSON.parse(galleryRaw);
    if (Array.isArray(arr)) {
      gallery = arr
        .filter(
          (p: unknown): p is { url: string; position: number } =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as Record<string, unknown>).url === "string" &&
            ((p as Record<string, unknown>).url as string).startsWith("/api/images/") &&
            typeof (p as Record<string, unknown>).position === "number" &&
            Number.isInteger((p as Record<string, unknown>).position) &&
            ((p as Record<string, unknown>).position as number) >= 0,
        )
        .slice(0, 5);
    }
  } catch {
    /* ignore */
  }
  await updateEvent(organizer.id, eventId, {
    coverUrl: coverUrl || null,
    creationStep: advanceCreationStep(ev.creationStep, next, types),
  });
  await replacePhotosForEvent(eventId, gallery);
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 9: Questions (per-attendee + per-registration) ----------

const customQuestionsArraySchema = z.array(customQuestionSchema).max(20);

export async function saveStepQuestionsAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const types = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("pytania", types) ?? "zgody";

  if (skip) {
    await updateEvent(organizer.id, eventId, {
      creationStep: advanceCreationStep(ev.creationStep, next, types),
    });
    return { ok: true, eventId, nextStep: next };
  }

  // Per-registration questions
  const regRaw = String(formData.get("customQuestions") ?? "[]");
  let regQuestions: unknown;
  try {
    regQuestions = JSON.parse(regRaw);
  } catch {
    return {
      errors: { customQuestions: "Niepoprawna konfiguracja pytań." },
      values: { customQuestions: regRaw },
    };
  }
  const regParsed = customQuestionsArraySchema.safeParse(regQuestions);
  if (!regParsed.success) {
    return {
      errors: { customQuestions: "Niepoprawna konfiguracja pytań." },
      values: { customQuestions: regRaw },
    };
  }

  // Per-attendee custom fields (one JSON blob per attendee type, named "customFields:<typeId>")
  if (types) {
    const updatedTypes = types.map((t) => {
      const raw = String(formData.get(`customFields:${t.id}`) ?? "");
      if (!raw.trim()) return t;
      try {
        const arr = JSON.parse(raw);
        return { ...t, customFields: arr };
      } catch {
        return t;
      }
    });
    await updateEvent(organizer.id, eventId, {
      customQuestions: JSON.stringify(regParsed.data),
      attendeeTypes: JSON.stringify(updatedTypes),
      creationStep: advanceCreationStep(ev.creationStep, next, types),
    });
  } else {
    await updateEvent(organizer.id, eventId, {
      customQuestions: JSON.stringify(regParsed.data),
      creationStep: advanceCreationStep(ev.creationStep, next, types),
    });
  }
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 10: Consents (final step — sets creationStep to 'complete') ----------

export async function saveStepConsentsAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  await requireOwnedDraft(organizer.id, eventId);

  if (skip) {
    await updateEvent(organizer.id, eventId, { creationStep: "complete" });
    redirect(`/dashboard/events/${eventId}`);
  }

  const raw = String(formData.get("consentConfig") ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      errors: { consentConfig: "Niepoprawna konfiguracja zgód." },
      values: { consentConfig: raw },
    };
  }
  const r = consentConfigSchema.safeParse(parsed);
  if (!r.success) {
    return {
      errors: { consentConfig: "Niepoprawna konfiguracja zgód." },
      values: { consentConfig: raw },
    };
  }
  await updateEvent(organizer.id, eventId, {
    consentConfig: JSON.stringify(r.data),
    creationStep: "complete",
  });
  redirect(`/dashboard/events/${eventId}`);
}

// ---------- Helpers ----------

function zodIssues(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

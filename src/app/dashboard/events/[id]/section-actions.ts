"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import {
  getEventForOrganizer,
  updateEvent,
  isSlugTakenForOrganizer,
} from "@/lib/db/queries/events-dashboard";
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
import { replacePhotosForEvent } from "@/lib/db/queries/event-photos";

export type SectionResult = { ok: true } | { errors: Record<string, string> };

async function authorize(eventId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  const ev = await getEventForOrganizer(organizer.id, eventId);
  if (!ev) throw new Error("Not found");
  return { organizer, ev };
}

function zodIssues(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

function loadAttendeeTypes(json: string | null): AttendeeType[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as AttendeeType[]) : null;
  } catch {
    return null;
  }
}

function pricesMax(types: AttendeeType[] | null): number {
  if (!types || types.length === 0) return 0;
  return types.reduce((m, t) => Math.max(m, t.priceCents), 0);
}

// ---------- Basics ----------

export async function saveSectionBasicsAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer, ev } = await authorize(eventId);
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "");
  const titleParsed = stepTitleSchema.safeParse({ title, slug });
  if (!titleParsed.success) return { errors: zodIssues(titleParsed.error.issues) };
  const descParsed = stepDescriptionSchema.safeParse({ description });
  if (!descParsed.success) return { errors: zodIssues(descParsed.error.issues) };
  if (slug !== ev.slug && (await isSlugTakenForOrganizer(organizer.id, slug))) {
    return { errors: { slug: "Ta nazwa w URL jest już zajęta" } };
  }
  await updateEvent(organizer.id, eventId, {
    title: titleParsed.data.title,
    slug: titleParsed.data.slug,
    description: description.trim() || null,
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Dates ----------

export async function saveSectionDatesAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const startsRaw = String(formData.get("startsAt") ?? "");
  const endsRaw = String(formData.get("endsAt") ?? "");
  const startsAt = startsRaw ? new Date(startsRaw).getTime() : NaN;
  const endsAt = endsRaw ? new Date(endsRaw).getTime() : NaN;
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return { errors: { startsAt: "Wybierz daty.", endsAt: "Wybierz daty." } };
  }
  const parsed = stepDatesSchema.safeParse({ startsAt, endsAt });
  if (!parsed.success) return { errors: zodIssues(parsed.error.issues) };
  await updateEvent(organizer.id, eventId, {
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Location ----------

export async function saveSectionLocationAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const location = String(formData.get("location") ?? "");
  const parsed = stepLocationSchema.safeParse({ location });
  if (!parsed.success) return { errors: zodIssues(parsed.error.issues) };
  await updateEvent(organizer.id, eventId, { location: location.trim() || null });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Attendees ----------

export async function saveSectionAttendeesAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const raw = String(formData.get("attendeeTypes") ?? "");
  if (!raw.trim()) return { errors: { attendeeTypes: "Wybierz szablon i ustaw cenę." } };
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { errors: { attendeeTypes: "Niepoprawna konfiguracja typów uczestników." } };
  }
  const parsed = attendeeTypesSchema.safeParse(parsedJson);
  if (!parsed.success) return { errors: { attendeeTypes: "Niepoprawna konfiguracja typów uczestników." } };
  const types = parsed.data as AttendeeType[];
  await updateEvent(organizer.id, eventId, {
    attendeeTypes: JSON.stringify(types),
    priceCents: pricesMax(types),
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Capacity ----------

export async function saveSectionCapacityAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const capacity = Number(formData.get("capacity") ?? "0");
  const parsed = stepCapacitySchema.safeParse({ capacity });
  if (!parsed.success) return { errors: zodIssues(parsed.error.issues) };
  await updateEvent(organizer.id, eventId, { capacity: parsed.data.capacity });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Payment ----------

export async function saveSectionPaymentAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const depositOn = formData.get("depositOn") === "true";
  const depositRaw = String(formData.get("deposit") ?? "");
  const balanceDueRaw = String(formData.get("balanceDueAt") ?? "");
  const depositCents = depositRaw ? Math.round(Number(depositRaw) * 100) : null;
  const balanceDueAt = balanceDueRaw ? new Date(balanceDueRaw).getTime() : null;
  const parsed = stepPaymentSchema.safeParse({ depositOn, depositCents, balanceDueAt });
  if (!parsed.success) return { errors: zodIssues(parsed.error.issues) };
  await updateEvent(organizer.id, eventId, {
    depositCents: depositOn ? depositCents : null,
    balanceDueAt: depositOn ? balanceDueAt : null,
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Photos ----------

export async function saveSectionPhotosAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
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
            Number.isInteger((p as Record<string, unknown>).position),
        )
        .slice(0, 5);
    }
  } catch {
    /* ignore */
  }
  await updateEvent(organizer.id, eventId, { coverUrl: coverUrl || null });
  await replacePhotosForEvent(eventId, gallery);
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Questions ----------

const customQuestionsArraySchema = z.array(customQuestionSchema).max(20);

export async function saveSectionQuestionsAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer, ev } = await authorize(eventId);
  const regRaw = String(formData.get("customQuestions") ?? "[]");
  let regParsedRaw: unknown;
  try {
    regParsedRaw = JSON.parse(regRaw);
  } catch {
    return { errors: { customQuestions: "Niepoprawna konfiguracja pytań." } };
  }
  const reg = customQuestionsArraySchema.safeParse(regParsedRaw);
  if (!reg.success) return { errors: { customQuestions: "Niepoprawna konfiguracja pytań." } };

  const types = loadAttendeeTypes(ev.attendeeTypes);
  const updatedTypes = types
    ? types.map((t) => {
        const raw = String(formData.get(`customFields:${t.id}`) ?? "");
        if (!raw.trim()) return t;
        try {
          const arr = JSON.parse(raw);
          return Array.isArray(arr) ? { ...t, customFields: arr } : t;
        } catch {
          return t;
        }
      })
    : null;

  await updateEvent(organizer.id, eventId, {
    customQuestions: JSON.stringify(reg.data),
    ...(updatedTypes ? { attendeeTypes: JSON.stringify(updatedTypes) } : {}),
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Consents ----------

export async function saveSectionConsentsAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const raw = String(formData.get("consentConfig") ?? "[]");
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(raw);
  } catch {
    return { errors: { consentConfig: "Niepoprawna konfiguracja zgód." } };
  }
  const r = consentConfigSchema.safeParse(parsedRaw);
  if (!r.success) return { errors: { consentConfig: "Niepoprawna konfiguracja zgód." } };
  await updateEvent(organizer.id, eventId, { consentConfig: JSON.stringify(r.data) });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

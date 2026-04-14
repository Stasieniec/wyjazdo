"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eventBaseSchema, customQuestionSchema } from "@/lib/validators/event";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer, updateEvent } from "@/lib/db/queries/events-dashboard";
import { zodIssuesToRecord } from "@/lib/zod-errors";

export type SaveEventFormState = { errors?: Record<string, string> } | null;

export async function saveEventAction(
  eventId: string,
  _prev: SaveEventFormState,
  formData: FormData,
): Promise<SaveEventFormState> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  const existing = await getEventForOrganizer(organizer.id, eventId);
  if (!existing) throw new Error("Not found");

  let questionsParsed;
  try {
    const questionsRaw = String(formData.get("customQuestions") ?? "[]");
    questionsParsed = z.array(customQuestionSchema).safeParse(JSON.parse(questionsRaw));
  } catch {
    return { errors: { customQuestions: "Nieprawidłowy format listy pytań." } };
  }
  if (!questionsParsed.success) {
    return {
      errors: {
        customQuestions:
          questionsParsed.error.issues[0]?.message ?? "Błąd walidacji pytań niestandardowych.",
      },
    };
  }

  const raw = {
    slug: existing.slug,
    title: String(formData.get("title") ?? ""),
    description: (formData.get("description") as string) || undefined,
    location: (formData.get("location") as string) || undefined,
    startsAt: new Date(String(formData.get("startsAt") ?? "")).getTime(),
    endsAt: new Date(String(formData.get("endsAt") ?? "")).getTime(),
    priceCents: Math.round(Number(formData.get("price") ?? 0) * 100),
    currency: "PLN" as const,
    capacity: Number(formData.get("capacity") ?? 0),
    coverUrl: (formData.get("coverUrl") as string) || undefined,
    customQuestions: questionsParsed.data,
  };
  const parsed = eventBaseSchema.safeParse(raw);
  if (!parsed.success) {
    const err = zodIssuesToRecord(parsed.error.issues);
    if (err.priceCents) {
      err.price = err.priceCents;
      delete err.priceCents;
    }
    return { errors: err };
  }
  if (parsed.data.endsAt < parsed.data.startsAt) {
    return {
      errors: {
        startsAt: "Koniec wydarzenia musi być po jego początku.",
        endsAt: "Koniec wydarzenia musi być po jego początku.",
      },
    };
  }

  await updateEvent(organizer.id, eventId, {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    location: parsed.data.location ?? null,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    priceCents: parsed.data.priceCents,
    capacity: parsed.data.capacity,
    coverUrl: parsed.data.coverUrl || null,
    customQuestions: JSON.stringify(parsed.data.customQuestions),
  });

  revalidatePath(`/dashboard/events/${eventId}`);
  return {};
}

const statusSchema = z.enum(["draft", "published", "archived"]);

export async function changeStatusAction(eventId: string, status: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) throw new Error("Invalid status");
  await updateEvent(organizer.id, eventId, { status: parsed.data });
  revalidatePath(`/dashboard/events/${eventId}`);
}

"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eventBaseSchema, customQuestionSchema } from "@/lib/validators/event";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer, updateEvent } from "@/lib/db/queries/events-dashboard";

export async function saveEventAction(eventId: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  const existing = await getEventForOrganizer(organizer.id, eventId);
  if (!existing) throw new Error("Not found");

  const questionsRaw = String(formData.get("customQuestions") ?? "[]");
  const questionsParsed = z.array(customQuestionSchema).safeParse(JSON.parse(questionsRaw));
  if (!questionsParsed.success) return { error: "Błąd w pytaniach niestandardowych" };

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
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.endsAt < parsed.data.startsAt) return { error: "Data końca przed datą początku" };

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
  return { ok: true };
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

"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eventBaseSchema } from "@/lib/validators/event";
import { newId } from "@/lib/ids";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { insertEvent, isSlugTakenForOrganizer } from "@/lib/db/queries/events-dashboard";

export async function createEventAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");

  const raw = {
    slug: String(formData.get("slug") ?? "").toLowerCase(),
    title: String(formData.get("title") ?? ""),
    description: (formData.get("description") as string) || undefined,
    location: (formData.get("location") as string) || undefined,
    startsAt: Number(new Date(String(formData.get("startsAt") ?? "")).getTime()),
    endsAt: Number(new Date(String(formData.get("endsAt") ?? "")).getTime()),
    priceCents: Math.round(Number(formData.get("price") ?? 0) * 100),
    currency: "PLN" as const,
    capacity: Number(formData.get("capacity") ?? 0),
    coverUrl: (formData.get("coverUrl") as string) || undefined,
    customQuestions: [],
  };

  const parsed = eventBaseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.endsAt < parsed.data.startsAt) return { error: "Data końca przed datą początku" };
  if (await isSlugTakenForOrganizer(organizer.id, parsed.data.slug)) {
    return { error: "Ta nazwa w URL jest już zajęta" };
  }

  const id = newId();
  const now = Date.now();
  await insertEvent({
    id,
    organizerId: organizer.id,
    slug: parsed.data.slug,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    location: parsed.data.location ?? null,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    priceCents: parsed.data.priceCents,
    currency: "PLN",
    capacity: parsed.data.capacity,
    coverUrl: parsed.data.coverUrl || null,
    status: "draft",
    customQuestions: JSON.stringify([]),
    createdAt: now,
    updatedAt: now,
  });

  redirect(`/dashboard/events/${id}`);
}

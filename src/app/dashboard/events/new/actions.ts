"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eventBaseSchema } from "@/lib/validators/event";
import { newId } from "@/lib/ids";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { insertEvent, isSlugTakenForOrganizer } from "@/lib/db/queries/events-dashboard";
import { zodIssuesToRecord } from "@/lib/zod-errors";

export type CreateEventFormState = { errors?: Record<string, string> } | null;

export async function createEventAction(
  _prev: CreateEventFormState,
  formData: FormData,
): Promise<CreateEventFormState> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");

  const depositRaw = formData.get("deposit") as string;
  const balanceDueAtRaw = formData.get("balanceDueAt") as string;
  const depositCents =
    depositRaw && depositRaw.trim() !== ""
      ? Math.round(Number(depositRaw) * 100)
      : null;
  const balanceDueAt =
    balanceDueAtRaw && balanceDueAtRaw.trim() !== ""
      ? new Date(balanceDueAtRaw).getTime()
      : null;

  const raw = {
    slug: String(formData.get("slug") ?? "").toLowerCase(),
    title: String(formData.get("title") ?? ""),
    description: (formData.get("description") as string) || undefined,
    location: (formData.get("location") as string) || undefined,
    startsAt: new Date(String(formData.get("startsAt") ?? "")).getTime(),
    endsAt: new Date(String(formData.get("endsAt") ?? "")).getTime(),
    priceCents: Math.round(Number(formData.get("price") ?? 0) * 100),
    currency: "PLN" as const,
    capacity: Number(formData.get("capacity") ?? 0),
    coverUrl: (formData.get("coverUrl") as string) || undefined,
    customQuestions: [],
    depositCents,
    balanceDueAt,
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
  if (await isSlugTakenForOrganizer(organizer.id, parsed.data.slug)) {
    return { errors: { slug: "Ta nazwa w URL jest już zajęta" } };
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
    depositCents: parsed.data.depositCents ?? null,
    balanceDueAt: parsed.data.balanceDueAt ?? null,
    createdAt: now,
    updatedAt: now,
  });

  redirect(`/dashboard/events/${id}`);
}

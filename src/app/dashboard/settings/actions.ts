"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrganizerByClerkUserId, updateOrganizer } from "@/lib/db/queries/organizers";
import { zodIssuesToRecord } from "@/lib/zod-errors";

const settingsSchema = z.object({
  displayName: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().refine(
    (v) => v === "" || v.startsWith("/api/images/") || v.startsWith("http"),
    "Nieprawidłowy adres zdjęcia",
  ).optional().or(z.literal("")),
  coverUrl: z.string().refine(
    (v) => v === "" || v.startsWith("/api/images/") || v.startsWith("http"),
    "Nieprawidłowy adres zdjęcia",
  ).optional().or(z.literal("")),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal("")),
  contactEmail: z.string().email("Nieprawidłowy adres email").max(200),
  contactPhone: z.string().max(32).optional(),
  website: z.string().url().optional().or(z.literal("")),
  instagram: z.string().max(64).optional(),
  facebook: z.string().max(128).optional(),
});

function emptyToNull(v: string | undefined | null) {
  return v && v.length > 0 ? v : null;
}

export type SettingsFormState = { errors?: Record<string, string> } | null;

export async function updateSettingsAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: zodIssuesToRecord(parsed.error.issues) };
  const d = parsed.data;

  const socialLinks = JSON.stringify({
    website: emptyToNull(d.website),
    instagram: emptyToNull(d.instagram),
    facebook: emptyToNull(d.facebook),
  });

  await updateOrganizer(organizer.id, {
    displayName: d.displayName,
    description: emptyToNull(d.description),
    logoUrl: emptyToNull(d.logoUrl),
    coverUrl: emptyToNull(d.coverUrl),
    brandColor: emptyToNull(d.brandColor),
    contactEmail: d.contactEmail,
    contactPhone: emptyToNull(d.contactPhone),
    socialLinks,
  });

  revalidatePath("/dashboard/settings");
  return {};
}

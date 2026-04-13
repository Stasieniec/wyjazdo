"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { organizerProfileSchema } from "@/lib/validators/organizer";
import { newId } from "@/lib/ids";
import {
  createOrganizer,
  getOrganizerByClerkUserId,
  isSubdomainTaken,
} from "@/lib/db/queries/organizers";

export async function createOrganizerAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existing = await getOrganizerByClerkUserId(userId);
  if (existing) redirect("/dashboard");

  const parsed = organizerProfileSchema.safeParse({
    subdomain: String(formData.get("subdomain") ?? "").toLowerCase(),
    displayName: String(formData.get("displayName") ?? ""),
    description: (formData.get("description") as string) || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  if (await isSubdomainTaken(parsed.data.subdomain)) {
    return { error: "Ta nazwa jest już zajęta" };
  }

  await createOrganizer({
    id: newId(),
    clerkUserId: userId,
    subdomain: parsed.data.subdomain,
    displayName: parsed.data.displayName,
    description: parsed.data.description ?? null,
  });

  redirect("/dashboard");
}

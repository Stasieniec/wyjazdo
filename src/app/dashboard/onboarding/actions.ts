"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { organizerProfileSchema } from "@/lib/validators/organizer";
import { newId } from "@/lib/ids";
import {
  createOrganizer,
  getOrganizerByClerkUserId,
  isSubdomainTaken,
} from "@/lib/db/queries/organizers";
import { getLatestDocument, insertOrganizerConsent } from "@/lib/db/queries/legal";

export async function createOrganizerAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existing = await getOrganizerByClerkUserId(userId);
  if (existing) redirect("/dashboard");

  const parsed = organizerProfileSchema.safeParse({
    subdomain: String(formData.get("subdomain") ?? "").toLowerCase(),
    displayName: String(formData.get("displayName") ?? ""),
    description: (formData.get("description") as string) || undefined,
    acceptTerms: formData.get("acceptTerms") === "true" ? true : false,
    acceptPrivacy: formData.get("acceptPrivacy") === "true" ? true : false,
    acceptDpa: formData.get("acceptDpa") === "true" ? true : false,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }

  if (await isSubdomainTaken(parsed.data.subdomain)) {
    return { error: "Ta nazwa jest już zajęta" };
  }

  const user = await currentUser();
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const now = Date.now();
  const organizerId = newId();

  await createOrganizer({
    id: organizerId,
    clerkUserId: userId,
    subdomain: parsed.data.subdomain,
    displayName: parsed.data.displayName,
    description: parsed.data.description ?? null,
    contactEmail: primaryEmail,
    termsAcceptedAt: now,
    dpaAcceptedAt: now,
  });

  // Record consent audit trail (best-effort -- don't block onboarding if docs not seeded yet)
  const [regulamin, privacyPolicy, dpa] = await Promise.all([
    getLatestDocument("regulamin"),
    getLatestDocument("privacy_policy"),
    getLatestDocument("dpa"),
  ]);

  const consentPromises: Promise<void>[] = [];
  if (regulamin) {
    consentPromises.push(insertOrganizerConsent({ organizerId, documentId: regulamin.id, ipAddress: ip }));
  }
  if (privacyPolicy) {
    consentPromises.push(insertOrganizerConsent({ organizerId, documentId: privacyPolicy.id, ipAddress: ip }));
  }
  if (dpa) {
    consentPromises.push(insertOrganizerConsent({ organizerId, documentId: dpa.id, ipAddress: ip }));
  }
  await Promise.allSettled(consentPromises);

  redirect("/dashboard");
}

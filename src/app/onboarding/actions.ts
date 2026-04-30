"use server";

import { auth } from "@clerk/nextjs/server";
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

export type CreateOrganizerResult =
  | { error: string; jumpToStep?: number }
  | { errors: Record<string, string>; jumpToStep?: number }
  | undefined;

// Map a field name to the wizard step index that owns that field.
// state.step indexing: 0=welcome, 1=name, 2=subdomain, 3=email, 4=description, 5=consents.
const FIELD_TO_STEP: Record<string, number> = {
  displayName: 1,
  subdomain: 2,
  contactEmail: 3,
  description: 4,
  acceptTerms: 5,
  acceptPrivacy: 5,
  acceptDpa: 5,
};

export async function createOrganizerAction(formData: FormData): Promise<CreateOrganizerResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existing = await getOrganizerByClerkUserId(userId);
  if (existing) redirect("/dashboard");

  const subdomainRaw = String(formData.get("subdomain") ?? "").toLowerCase();

  const parsed = organizerProfileSchema.safeParse({
    subdomain: subdomainRaw,
    displayName: String(formData.get("displayName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? "").trim(),
    description: (formData.get("description") as string) || undefined,
    acceptTerms: formData.get("acceptTerms") === "true" ? true : false,
    acceptPrivacy: formData.get("acceptPrivacy") === "true" ? true : false,
    acceptDpa: formData.get("acceptDpa") === "true" ? true : false,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    let firstField: string | null = null;
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_form");
      if (!errors[key]) {
        errors[key] = issue.message;
        if (!firstField) firstField = key;
      }
    }
    const jumpToStep = firstField ? FIELD_TO_STEP[firstField] : undefined;
    return { errors, jumpToStep };
  }

  if (await isSubdomainTaken(parsed.data.subdomain)) {
    return { error: "Ten adres jest już zajęty — spróbuj inny", jumpToStep: 2 };
  }

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
    contactEmail: parsed.data.contactEmail,
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

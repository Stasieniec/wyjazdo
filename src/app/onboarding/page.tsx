import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existing = await getOrganizerByClerkUserId(userId);
  if (existing) redirect("/dashboard");

  const user = await currentUser();
  const firstName = user?.firstName ?? null;
  const defaultContactEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";

  return <OnboardingWizard firstName={firstName} defaultContactEmail={defaultContactEmail} />;
}

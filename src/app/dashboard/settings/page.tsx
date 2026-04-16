import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  const social = organizer.socialLinks
    ? (JSON.parse(organizer.socialLinks) as Record<string, string | null>)
    : {};

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl">Ustawienia</h1>
      <SettingsForm
        defaults={{
          displayName: organizer.displayName,
          description: organizer.description,
          logoUrl: organizer.logoUrl,
          coverUrl: organizer.coverUrl,
          brandColor: organizer.brandColor,
          contactEmail: organizer.contactEmail,
          contactPhone: organizer.contactPhone,
          social,
        }}
      />
    </div>
  );
}

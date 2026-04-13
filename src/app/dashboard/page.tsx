import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";

export default async function DashboardHome() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Wydarzenia</h1>
      <p className="mt-4 text-neutral-600">Witaj, {organizer.displayName}.</p>
      <p className="mt-2 text-sm text-neutral-500">
        Twoja strona: <code>{organizer.subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN}</code>
      </p>
    </div>
  );
}

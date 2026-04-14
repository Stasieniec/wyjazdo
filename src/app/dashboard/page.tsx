import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { listEventsForOrganizer } from "@/lib/db/queries/events-dashboard";

export default async function DashboardHome() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  const events = await listEventsForOrganizer(organizer.id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wydarzenia</h1>
        <Link
          href="/dashboard/events/new"
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + Nowe wydarzenie
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Nie masz jeszcze żadnych wydarzeń.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-lg border border-border bg-background">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href={`/dashboard/events/${e.id}`} className="font-medium hover:underline">
                  {e.title}
                </Link>
                <div className="text-sm text-muted-foreground">
                  {new Date(e.startsAt).toLocaleDateString("pl-PL")} &middot; {e.status}
                </div>
              </div>
              <Link
                href={`/dashboard/events/${e.id}`}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                Edytuj &rarr;
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

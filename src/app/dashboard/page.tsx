import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { countTakenSpots } from "@/lib/capacity";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { listEventsForOrganizer } from "@/lib/db/queries/events-dashboard";
import { Card, StatusBadge } from "@/components/ui";

export default async function DashboardHome() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  const events = await listEventsForOrganizer(organizer.id);
  const nowMs = Date.now();
  const eventsWithTaken = await Promise.all(
    events.map(async (e) => ({
      ...e,
      taken: await countTakenSpots(e.id, nowMs),
    })),
  );

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
        <Card padding="none" className="mt-8">
          <ul className="divide-y divide-border">
            {eventsWithTaken.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/dashboard/events/${e.id}`} className="font-medium hover:underline">
                    {e.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{new Date(e.startsAt).toLocaleDateString("pl-PL")}</span>
                    <span>&middot;</span>
                    <span>
                      {e.taken}/{e.capacity}
                    </span>
                    {e.location ? (
                      <>
                        <span>&middot;</span>
                        <span className="truncate" title={e.location}>
                          {e.location}
                        </span>
                      </>
                    ) : null}
                    <span>&middot;</span>
                    <StatusBadge status={e.status} />
                  </div>
                </div>
                <Link
                  href={`/dashboard/events/${e.id}`}
                  className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
                >
                  Edytuj &rarr;
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { countTakenSpots } from "@/lib/capacity";
import { DashboardEventCard } from "@/components/dashboard/DashboardEventCard";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { listEventsForOrganizer } from "@/lib/db/queries/events-dashboard";
import { Card } from "@/components/ui";

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
        <Card className="mt-8 text-center" padding="lg">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Twoje pierwsze wydarzenie
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Jeszcze nie masz żadnych wydarzeń. Stwórz pierwsze — w&nbsp;kilka minut zbudujesz
            stronę, zaczniesz zbierać zapisy i&nbsp;płatności online.
          </p>
          <Link
            href="/dashboard/events/new"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
          >
            + Stwórz wydarzenie
          </Link>
        </Card>
      ) : (
        <ul className="mt-8 grid list-none gap-4 p-0 sm:gap-5">
          {eventsWithTaken.map((e) => (
            <li key={e.id}>
              <DashboardEventCard
                id={e.id}
                title={e.title}
                startsAt={e.startsAt}
                taken={e.taken}
                capacity={e.capacity}
                location={e.location}
                status={e.status}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

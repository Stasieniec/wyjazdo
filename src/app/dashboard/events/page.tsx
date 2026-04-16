import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { countTakenSpots } from "@/lib/capacity";
import { DashboardEventCard } from "@/components/dashboard/DashboardEventCard";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { listEventsForOrganizer } from "@/lib/db/queries/events-dashboard";

export default async function EventsListPage() {
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
      {(organizer.stripeOnboardingComplete !== 1 ||
        organizer.stripePayoutsEnabled !== 1) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 mb-6">
          Dokończ konfigurację Stripe, aby móc publikować wydarzenia.{" "}
          <Link
            href="/dashboard/onboarding/payouts"
            className="underline font-medium"
          >
            Konfiguruj
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Wydarzenia</h1>
        <Link
          href="/dashboard/events/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
        >
          + Nowe wydarzenie
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-background p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Brak wydarzeń</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Stwórz pierwsze wydarzenie — w kilka minut zbudujesz stronę, zaczniesz
            zbierać zapisy i płatności online.
          </p>
          <Link
            href="/dashboard/events/new"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all hover:bg-accent/90"
          >
            + Utwórz wydarzenie
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid list-none gap-4 p-0">
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

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import {
  getOverviewStats,
  getAttentionItems,
  getRecentActivity,
} from "@/lib/db/queries/dashboard-overview";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatPlnFromCents } from "@/lib/format-currency";

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "wczoraj" : `${days} dni temu`;
}

function formatDaysUntil(startsAt: number): string {
  const diff = startsAt - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "dzisiaj";
  if (days === 1) return "jutro";
  return `za ${days} dni`;
}

export default async function DashboardOverview() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  const [stats, attentionItems, recentActivity] = await Promise.all([
    getOverviewStats(organizer.id),
    getAttentionItems(organizer.id),
    getRecentActivity(organizer.id, 5),
  ]);

  const firstName = organizer.displayName.split(" ")[0];
  const today = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            Dzień dobry, {firstName} 👋
          </h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{today}</p>
        </div>
        <Link
          href="/dashboard/events/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
        >
          + Nowe wydarzenie
        </Link>
      </div>

      {/* Stripe onboarding warning */}
      {(organizer.stripeOnboardingComplete !== 1 ||
        organizer.stripePayoutsEnabled !== 1) && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Dokończ konfigurację Stripe, aby móc publikować wydarzenia.{" "}
          <Link
            href="/dashboard/onboarding/payouts"
            className="font-medium underline"
          >
            Konfiguruj
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Przychód"
          variant="navy"
          subtitle={`${stats.totalParticipants} uczestników łącznie`}
          className="sm:col-span-2 lg:col-span-1"
        >
          {formatPlnFromCents(stats.totalRevenueCents)}
        </StatCard>
        <StatCard label="Aktywne wydarzenia" subtitle="opublikowanych">
          {stats.activeEventCount}
        </StatCard>
        {stats.nearestEvent ? (
          <StatCard
            label="Najbliższe wydarzenie"
            subtitle={`${formatDaysUntil(stats.nearestEvent.startsAt)} · ${stats.nearestEvent.taken}/${stats.nearestEvent.capacity} miejsc`}
          >
            <span className="text-base font-bold sm:text-lg">{stats.nearestEvent.title}</span>
          </StatCard>
        ) : (
          <StatCard label="Najbliższe wydarzenie" subtitle="brak nadchodzących">
            —
          </StatCard>
        )}
      </div>

      {/* Attention items */}
      {attentionItems.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Wymaga uwagi</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
            {attentionItems.map((item, i) => (
              <div
                key={`${item.eventId}-${item.type}`}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < attentionItems.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      item.type === "unpaid"
                        ? "bg-accent"
                        : item.type === "waitlist"
                          ? "bg-amber-500"
                          : "bg-success"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground">{item.eventTitle}</span>
                    <span className="text-muted-foreground"> — {item.description}</span>
                  </div>
                </div>
                {item.type !== "full" ? (
                  <Link
                    href={`/dashboard/events/${item.eventId}?tab=uczestnicy`}
                    className="shrink-0 text-xs font-semibold text-accent transition-colors hover:text-accent/80"
                  >
                    Sprawdź →
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Gotowe ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Ostatnia aktywność</h2>
          <div className="mt-3 flex flex-col gap-2">
            {recentActivity.map((activity) => (
              <div
                key={activity.participantId}
                className="flex items-center gap-2 text-sm"
              >
                <div
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    activity.type === "cancellation"
                      ? "bg-amber-500"
                      : "bg-success"
                  }`}
                />
                <span className="min-w-0 text-foreground">
                  {activity.type === "cancellation" ? "Anulowanie" : "Nowy zapis"} —{" "}
                  <strong>
                    {activity.firstName} {activity.lastName}
                  </strong>{" "}
                  → {activity.eventTitle}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {relativeTime(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — no events at all */}
      {stats.activeEventCount === 0 && attentionItems.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-background p-8 text-center shadow-sm">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Twoje pierwsze wydarzenie
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Jeszcze nie masz żadnych wydarzeń. Stwórz pierwsze — w kilka minut
            zbudujesz stronę, zaczniesz zbierać zapisy i płatności online.
          </p>
          <Link
            href="/dashboard/events/new"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all hover:bg-accent/90"
          >
            + Utwórz wydarzenie
          </Link>
        </div>
      )}
    </div>
  );
}

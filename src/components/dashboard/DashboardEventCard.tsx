import Link from "next/link";
import { Button, StatusBadge } from "@/components/ui";

type EventStatus = "draft" | "published" | "archived";

type DashboardEventCardProps = {
  id: string;
  title: string;
  startsAt: number;
  taken: number;
  capacity: number;
  location: string | null;
  status: EventStatus;
};

export function DashboardEventCard({
  id,
  title,
  startsAt,
  taken,
  capacity,
  location,
  status,
}: DashboardEventCardProps) {
  const editHref = `/dashboard/events/${id}`;
  const participantsHref = `/dashboard/events/${id}?tab=uczestnicy`;
  const fillPct = capacity > 0 ? Math.min(100, Math.round((taken / capacity) * 100)) : 0;
  const isFull = capacity > 0 && taken >= capacity;

  const dateStr = new Date(startsAt).toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-[box-shadow,transform] hover:shadow-md"
    >
      <div
        className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-accent to-primary opacity-90"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 p-5 pl-6 sm:flex-row sm:items-stretch sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
          </div>
          <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-foreground">
            <Link
              href={editHref}
              className="transition-colors hover:text-primary hover:underline"
            >
              {title}
            </Link>
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              <span>{dateStr}</span>
            </span>
            {location ? (
              <>
                <span className="text-border" aria-hidden>
                  ·
                </span>
                <span className="truncate" title={location}>
                  {location}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end sm:text-right">
          <div
            className={`rounded-xl border px-4 py-3 sm:min-w-[11rem] ${
              isFull
                ? "border-accent/40 bg-accent/[0.07]"
                : "border-primary/15 bg-primary/[0.04]"
            }`}
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Zapisów
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-3 sm:justify-end">
              <span
                className={`font-mono text-4xl font-bold tabular-nums tracking-tight ${
                  isFull ? "text-accent" : "text-primary"
                }`}
              >
                {taken}
              </span>
              <span className="text-sm text-muted-foreground">
                z <span className="font-medium text-foreground">{capacity}</span> miejsc
              </span>
            </div>
            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted sm:w-44"
              role="progressbar"
              aria-valuenow={taken}
              aria-valuemin={0}
              aria-valuemax={capacity}
              aria-label={`Zajęte miejsca: ${taken} z ${capacity}`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  isFull ? "bg-accent" : "bg-primary"
                }`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            {isFull ? (
              <p className="mt-2 text-xs font-medium text-accent">Brak wolnych miejsc</p>
            ) : capacity > 0 && fillPct >= 75 ? (
              <p className="mt-2 text-xs text-muted-foreground">Pozostało niewiele miejsc</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button href={editHref} variant="secondary" size="sm" className="w-full sm:w-auto">
              Edytuj
            </Button>
            <Button href={participantsHref} variant="accent" size="sm" className="w-full sm:w-auto">
              Zobacz uczestników
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

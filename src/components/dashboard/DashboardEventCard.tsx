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
  const isFull = capacity > 0 && taken >= capacity;

  const dateStr = new Date(startsAt).toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
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
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">{taken}</span>
            <span aria-hidden> / </span>
            <span className="tabular-nums text-foreground">{capacity}</span>
            <span> miejsc</span>
            {isFull ? (
              <span className="text-muted-foreground"> · pełny</span>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
          <Button href={editHref} variant="secondary" size="sm" className="w-full sm:w-auto">
            Edytuj
          </Button>
          <Button href={participantsHref} variant="accent" size="sm" className="w-full sm:w-auto">
            Zobacz uczestników
          </Button>
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

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

const MONTHS_PL = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];

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

  const date = new Date(startsAt);
  const day = date.getDate();
  const month = MONTHS_PL[date.getMonth()];

  const dateStr = date.toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="rounded-xl border border-border bg-background shadow-sm transition-all duration-150 hover:shadow-md">
      <div className="flex items-center gap-4 p-4 sm:gap-5">
        {/* Date block */}
        <div className="hidden sm:flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#2d5a8a] text-white">
          <span className="text-[10px] font-semibold uppercase leading-none">{month}</span>
          <span className="text-lg font-bold leading-none">{day}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {isFull && (
              <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                Wypełnione
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-base font-semibold leading-snug text-foreground">
            <Link
              href={editHref}
              className="transition-colors hover:text-primary"
            >
              {title}
            </Link>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>{dateStr}</span>
            {location && (
              <>
                <span className="text-border" aria-hidden>·</span>
                <span className="truncate">{location}</span>
              </>
            )}
            <span className="text-border" aria-hidden>·</span>
            <span>
              <span className="tabular-nums font-medium text-foreground">{taken}</span>
              /{capacity} miejsc
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
          <Button href={editHref} variant="secondary" size="sm">
            Edytuj
          </Button>
          <Button href={participantsHref} variant="accent" size="sm">
            Uczestnicy
          </Button>
        </div>
      </div>
    </article>
  );
}

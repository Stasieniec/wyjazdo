import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string; eventSlug: string }>;
}): Promise<Metadata> {
  const { subdomain, eventSlug } = await params;
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) return {};
  const event = await getPublishedEventBySlug(organizer.id, eventSlug);
  if (!event) return {};

  const priceFormatted = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: event.currency,
  }).format(event.priceCents / 100);

  return {
    title: `${event.title} — ${organizer.displayName}`,
    description: event.description
      ? event.description.slice(0, 160)
      : `${event.title} · ${priceFormatted} · ${organizer.displayName}`,
    openGraph: {
      title: event.title,
      description: event.description?.slice(0, 160) ?? "",
      ...(event.coverUrl ? { images: [{ url: event.coverUrl }] } : {}),
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ subdomain: string; eventSlug: string }>;
}) {
  const { subdomain, eventSlug } = await params;
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) notFound();
  const event = await getPublishedEventBySlug(organizer.id, eventSlug);
  if (!event) notFound();

  const taken = await countTakenSpots(event.id, Date.now());
  const spotsLeft = Math.max(0, event.capacity - taken);
  const isFull = spotsLeft === 0;
  const priceFormatted = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: event.currency,
  }).format(event.priceCents / 100);

  const dateStart = new Date(event.startsAt).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateEnd = new Date(event.endsAt).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const brandColor = organizer.brandColor ?? "#1E3A5F";

  return (
    <main
      className="min-h-screen bg-background"
      style={{ "--brand": brandColor } as React.CSSProperties}
    >
      {/* Hero / Cover */}
      {event.coverUrl ? (
        <div className="relative h-64 w-full sm:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      ) : (
        <div
          className="h-32 w-full sm:h-48"
          style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
        />
      )}

      <div className="mx-auto max-w-3xl px-6">
        {/* Title area — overlaps hero slightly */}
        <div className={event.coverUrl ? "-mt-12 relative" : "pt-8"}>
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; {organizer.displayName}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {event.title}
          </h1>
        </div>

        {/* Info grid */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Termin" value={dateStart === dateEnd ? dateStart : `${dateStart} — ${dateEnd}`} />
          <InfoCard label="Miejsce" value={event.location ?? "Do ustalenia"} />
          <InfoCard label="Cena" value={priceFormatted} />
          <InfoCard
            label="Dostępność"
            value={isFull ? "Brak miejsc" : `${spotsLeft} wolnych miejsc`}
            accent={isFull}
          />
        </div>

        {/* Description */}
        {event.description && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-foreground">O wydarzeniu</h2>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          </section>
        )}

        {/* CTA */}
        <div className="mt-10 pb-16">
          <Link
            href={`/${event.slug}/register`}
            className="inline-flex items-center justify-center rounded-lg px-8 py-3.5 text-base font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            {isFull ? "Dołącz do listy rezerwowej" : "Zapisz się"}
          </Link>
          {isFull && (
            <p className="mt-3 text-sm text-muted-foreground">
              Wszystkie miejsca zajęte. Możesz zapisać się na listę rezerwową.
            </p>
          )}
        </div>

        {/* Organizer card */}
        <div className="border-t border-border pb-16 pt-10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Organizator
          </p>
          <Link href="/" className="mt-3 flex items-center gap-3 group">
            {organizer.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organizer.logoUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: brandColor }}
              >
                {organizer.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <span className="font-medium text-foreground group-hover:underline">
                {organizer.displayName}
              </span>
              {organizer.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {organizer.description}
                </p>
              )}
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-semibold ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}

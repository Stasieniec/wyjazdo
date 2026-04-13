import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        &larr; {organizer.displayName}
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{event.title}</h1>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-neutral-500">Termin</dt>
          <dd>
            {new Date(event.startsAt).toLocaleDateString("pl-PL")} &ndash;{" "}
            {new Date(event.endsAt).toLocaleDateString("pl-PL")}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">Miejsce</dt>
          <dd>{event.location ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">Cena</dt>
          <dd>{priceFormatted}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">Dostępność</dt>
          <dd>{isFull ? "Brak miejsc — lista rezerwowa" : `${spotsLeft} wolnych miejsc`}</dd>
        </div>
      </dl>

      {event.description && (
        <p className="mt-8 whitespace-pre-wrap text-neutral-700">{event.description}</p>
      )}

      <div className="mt-10">
        <Link
          href={`/${event.slug}/register`}
          className="inline-block rounded-lg bg-neutral-900 px-6 py-3 font-medium text-white hover:bg-neutral-800"
        >
          {isFull ? "Dołącz do listy rezerwowej" : "Zapisz się"}
        </Link>
      </div>
    </main>
  );
}

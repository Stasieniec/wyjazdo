import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrganizerBySubdomain, getPublishedEventsByOrganizer } from "@/lib/db/queries/organizers";

export default async function OrganizerProfilePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) notFound();

  const events = await getPublishedEventsByOrganizer(organizer.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {organizer.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={organizer.coverUrl} alt="" className="mb-6 h-48 w-full rounded-xl object-cover" />
      )}
      <div className="flex items-center gap-4">
        {organizer.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={organizer.logoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        )}
        <h1 className="text-3xl font-bold">{organizer.displayName}</h1>
      </div>
      {organizer.description && (
        <p className="mt-4 whitespace-pre-wrap leading-relaxed text-foreground">{organizer.description}</p>
      )}

      <h2 className="mt-10 text-xl font-semibold">Nadchodzące wydarzenia</h2>
      {events.length === 0 ? (
        <p className="mt-4 text-muted-foreground">Brak nadchodzących wydarzeń.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg border border-border p-4 transition-colors hover:bg-muted">
              <Link href={`/${e.slug}`} className="block">
                <div className="font-medium">{e.title}</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(e.startsAt).toLocaleDateString("pl-PL")} &middot; {e.location}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

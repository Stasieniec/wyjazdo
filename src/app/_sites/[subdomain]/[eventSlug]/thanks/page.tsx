import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { getParticipantById } from "@/lib/db/queries/participants";

export const dynamic = "force-dynamic";

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string; eventSlug: string }>;
  searchParams: Promise<{ pid?: string; waitlisted?: string }>;
}) {
  const { subdomain, eventSlug } = await params;
  const { pid, waitlisted } = await searchParams;
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) notFound();
  const event = await getPublishedEventBySlug(organizer.id, eventSlug);
  if (!event) notFound();

  const brandColor = organizer.brandColor ?? "#1E3A5F";

  if (waitlisted === "1") {
    return (
      <main
        className="mx-auto max-w-xl px-6 py-16 text-center"
        style={{ "--brand": brandColor } as React.CSSProperties}
      >
        <div
          className="mx-auto h-1 w-14 rounded-full"
          style={{ backgroundColor: "var(--brand)" }}
          aria-hidden
        />
        <h1 className="mt-4 text-2xl font-semibold">Jesteś na liście rezerwowej</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Powiadomimy Cię, gdy zwolni się miejsce na wydarzenie <strong>{event.title}</strong>.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline">
          &larr; Wróć
        </Link>
      </main>
    );
  }

  const participant = pid ? await getParticipantById(pid) : null;
  const status = participant?.status ?? "unknown";

  return (
    <main
      className="mx-auto max-w-xl px-6 py-16 text-center"
      style={{ "--brand": brandColor } as React.CSSProperties}
    >
      {status === "paid" ? (
        <>
          <div
            className="mx-auto h-1 w-14 rounded-full"
            style={{ backgroundColor: "var(--brand)" }}
            aria-hidden
          />
          <h1 className="mt-4 text-2xl font-semibold">Dziękujemy za zapis!</h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Twoje miejsce na <strong>{event.title}</strong> zostało potwierdzone.
          </p>
        </>
      ) : status === "pending" ? (
        <>
          <h1 className="text-2xl font-semibold">Przetwarzamy płatność...</h1>
          <p className="mt-4 text-muted-foreground">Ta strona odświeży się automatycznie.</p>
          <meta httpEquiv="refresh" content="5" />
        </>
      ) : status === "cancelled" ? (
        <>
          <h1 className="text-2xl font-semibold">Płatność nie powiodła się</h1>
          <p className="mt-4 text-muted-foreground">Możesz spróbować zapisać się ponownie.</p>
          <Link
            href={`/${eventSlug}/register`}
            className="mt-8 inline-block rounded-md px-4 py-2 font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--brand)" }}
          >
            Spróbuj ponownie
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Status nieznany</h1>
          <p className="mt-4 text-muted-foreground">Skontaktuj się z organizatorem.</p>
        </>
      )}
    </main>
  );
}

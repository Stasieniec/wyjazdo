import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { getParticipantById } from "@/lib/db/queries/participants";
import { Card, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

function formatEventDates(event: { startsAt: number; endsAt: number }) {
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
  return dateStart === dateEnd ? dateStart : `${dateStart} — ${dateEnd}`;
}

function EventSummary({ title, dateLabel }: { title: string; dateLabel: string }) {
  return (
    <div className="mb-6 border-b border-border pb-6 text-left">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
    </div>
  );
}

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
  const cssVars = { "--brand": brandColor } as CSSProperties;
  const eventDateLabel = formatEventDates(event);

  const organizerFooter = (
    <p className="mt-8 text-center text-sm text-muted-foreground">
      Organizator:{" "}
      <Link
        href="/"
        className="font-medium text-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        {organizer.displayName}
      </Link>
    </p>
  );

  if (waitlisted === "1") {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center" style={cssVars}>
        <div
          className="mx-auto h-1 w-14 rounded-full"
          style={{ backgroundColor: "var(--brand)" }}
          aria-hidden
        />
        <Card className="mt-6 text-left">
          <EventSummary title={event.title} dateLabel={eventDateLabel} />
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Jesteś na liście rezerwowej</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Powiadomimy Cię, gdy zwolni się miejsce na wydarzenie <strong>{event.title}</strong>.
            </p>
          </div>
        </Card>
        {organizerFooter}
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          &larr; Wróć
        </Link>
      </main>
    );
  }

  const participant = pid ? await getParticipantById(pid) : null;
  const status = participant?.status ?? "unknown";

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center" style={cssVars}>
      <div
        className="mx-auto h-1 w-14 rounded-full"
        style={{ backgroundColor: "var(--brand)" }}
        aria-hidden
      />
      {status === "paid" ? (
        <>
          <Card className="mt-6 text-left">
            <EventSummary title={event.title} dateLabel={eventDateLabel} />
            <div className="text-center">
              <h1 className="text-2xl font-semibold">Dziękujemy za zapis!</h1>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Twoje miejsce na <strong>{event.title}</strong> zostało potwierdzone.
              </p>
            </div>
          </Card>
          {organizerFooter}
        </>
      ) : status === "pending" ? (
        <>
          <Card className="mt-6 text-left">
            <EventSummary title={event.title} dateLabel={eventDateLabel} />
            <div className="text-center">
              <h1 className="text-2xl font-semibold">Przetwarzamy płatność...</h1>
              <p className="mt-4 text-muted-foreground">Ta strona odświeży się automatycznie.</p>
              <meta httpEquiv="refresh" content="5" />
            </div>
          </Card>
          {organizerFooter}
        </>
      ) : status === "cancelled" ? (
        <>
          <Card className="mt-6 text-left">
            <EventSummary title={event.title} dateLabel={eventDateLabel} />
            <div className="text-center">
              <h1 className="text-2xl font-semibold">Płatność nie powiodła się</h1>
              <p className="mt-4 text-muted-foreground">Możesz spróbować zapisać się ponownie.</p>
              <form action={`/${eventSlug}/register`} className="mt-8 inline-block">
                <SubmitButton
                  variant="primary"
                  size="md"
                  className="text-white hover:opacity-90"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  Spróbuj ponownie
                </SubmitButton>
              </form>
            </div>
          </Card>
          {organizerFooter}
        </>
      ) : (
        <>
          <Card className="mt-6 text-left">
            <EventSummary title={event.title} dateLabel={eventDateLabel} />
            <div className="text-center">
              <h1 className="text-2xl font-semibold">Status nieznany</h1>
              <p className="mt-4 text-muted-foreground">Skontaktuj się z organizatorem.</p>
            </div>
          </Card>
          {organizerFooter}
        </>
      )}
    </main>
  );
}

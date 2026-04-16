import { notFound } from "next/navigation";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import { formatPlnFromCents, isDepositPricingMode } from "@/lib/format-currency";
import { DepositPriceBreakdown } from "@/components/sites/DepositPriceBreakdown";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({
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
  const isFull = taken >= event.capacity;
  const questions: CustomQuestion[] = event.customQuestions
    ? JSON.parse(event.customQuestions)
    : [];
  const consents: ConsentConfigItem[] = event.consentConfig
    ? JSON.parse(event.consentConfig)
    : [];

  const brandColor = organizer.brandColor ?? "#1E3A5F";

  const depositMode = isDepositPricingMode(event.priceCents, event.depositCents);

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
  const dateSummary =
    dateStart === dateEnd ? dateStart : `${dateStart} — ${dateEnd}`;

  return (
    <main
      className="mx-auto max-w-xl px-6 py-10"
      style={{ "--brand": brandColor } as React.CSSProperties}
    >
      <a
        href={`/${eventSlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Wróć do wydarzenia
      </a>

      <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
        <h1 className="text-lg font-semibold text-foreground">{event.title}</h1>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <span className="shrink-0 font-medium text-foreground/80">Termin</span>
            <span>{dateSummary}</span>
          </div>
          {depositMode ? (
            <DepositPriceBreakdown
              priceCents={event.priceCents}
              depositCents={event.depositCents!}
              balanceDueAt={event.balanceDueAt}
              className="text-left"
            />
          ) : (
            <div className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground/80">Cena</span>
              <span className="text-foreground">{formatPlnFromCents(event.priceCents)}</span>
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {isFull ? "Zapis na listę rezerwową" : "Formularz zapisu"}
      </p>

      <RegisterForm
        eventId={event.id}
        subdomain={subdomain}
        eventSlug={eventSlug}
        isFull={isFull}
        questions={questions}
        consents={consents}
      />
    </main>
  );
}

import { notFound } from "next/navigation";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";
import type { CustomQuestion } from "@/lib/validators/event";
import { Card, Input, Select, Textarea } from "@/components/ui";

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

  const brandColor = organizer.brandColor ?? "#1E3A5F";

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
        <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground/80">Termin</dt>
            <dd>{dateSummary}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground/80">Cena</dt>
            <dd>{priceFormatted}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {isFull ? "Zapis na listę rezerwową" : "Formularz zapisu"}
      </p>

      <Card className="mt-4">
        <form action="/api/register" method="POST" className="space-y-4">
          <input type="hidden" name="eventId" value={event.id} />
          <input type="hidden" name="organizerSubdomain" value={subdomain} />
          <input type="hidden" name="eventSlug" value={eventSlug} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Imię" name="firstName" required maxLength={100} />
            <Input label="Nazwisko" name="lastName" required maxLength={100} />
          </div>
          <Input type="email" label="Email" name="email" required />
          <Input label="Telefon" name="phone" />

          {questions.map((q) => {
            const label = `${q.label}${q.required ? " *" : ""}`;
            if (q.type === "long_text") {
              return (
                <Textarea
                  key={q.id}
                  label={label}
                  name={`q_${q.id}`}
                  required={q.required}
                  rows={3}
                />
              );
            }
            if (q.type === "select") {
              return (
                <Select
                  key={q.id}
                  label={label}
                  name={`q_${q.id}`}
                  required={q.required}
                  placeholder="—"
                  options={
                    q.options?.map((opt) => ({ value: opt, label: opt })) ?? []
                  }
                />
              );
            }
            return (
              <Input
                key={q.id}
                label={label}
                name={`q_${q.id}`}
                required={q.required}
                maxLength={500}
              />
            );
          })}

          <button
            type="submit"
            className="rounded-md px-6 py-3 font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {isFull ? "Dołącz do listy rezerwowej" : "Przejdź do płatności"}
          </button>
        </form>
      </Card>
    </main>
  );
}

import { notFound } from "next/navigation";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";
import type { CustomQuestion } from "@/lib/validators/event";

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

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-semibold">{event.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {isFull ? "Zapis na listę rezerwową" : "Formularz zapisu"}
      </p>

      <form action="/api/register" method="POST" className="mt-8 space-y-4">
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="organizerSubdomain" value={subdomain} />
        <input type="hidden" name="eventSlug" value={eventSlug} />

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Imię</span>
            <input name="firstName" required maxLength={100} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nazwisko</span>
            <input name="lastName" required maxLength={100} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input type="email" name="email" required className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Telefon</span>
          <input name="phone" className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>

        {questions.map((q) => (
          <label key={q.id} className="block">
            <span className="text-sm font-medium">
              {q.label}
              {q.required && " *"}
            </span>
            {q.type === "long_text" ? (
              <textarea name={`q_${q.id}`} required={q.required} rows={3} className="mt-1 w-full rounded-md border px-3 py-2" />
            ) : q.type === "select" ? (
              <select name={`q_${q.id}`} required={q.required} className="mt-1 w-full rounded-md border px-3 py-2">
                <option value="">—</option>
                {q.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input name={`q_${q.id}`} required={q.required} maxLength={500} className="mt-1 w-full rounded-md border px-3 py-2" />
            )}
          </label>
        ))}

        <button
          type="submit"
          className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {isFull ? "Dołącz do listy rezerwowej" : "Przejdź do płatności"}
        </button>
      </form>
    </main>
  );
}

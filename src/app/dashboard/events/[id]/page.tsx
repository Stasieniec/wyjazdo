import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer } from "@/lib/db/queries/events-dashboard";
import type { CustomQuestion } from "@/lib/validators/event";
import CustomQuestionsEditor from "@/components/dashboard/CustomQuestionsEditor";
import ParticipantsTable from "@/components/dashboard/ParticipantsTable";
import { saveEventAction, changeStatusAction } from "./actions";

function toLocalInput(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EventEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");
  const event = await getEventForOrganizer(organizer.id, id);
  if (!event) notFound();

  const questions: CustomQuestion[] = event.customQuestions
    ? JSON.parse(event.customQuestions)
    : [];

  async function saveBound(formData: FormData) {
    "use server";
    await saveEventAction(id, formData);
  }
  const publishBound = changeStatusAction.bind(null, id, "published");
  const unpublishBound = changeStatusAction.bind(null, id, "draft");
  const archiveBound = changeStatusAction.bind(null, id, "archived");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-neutral-100 px-2 py-1">{event.status}</span>
          {event.status !== "published" && (
            <form action={publishBound}>
              <button className="rounded bg-green-600 px-3 py-1 text-white">Opublikuj</button>
            </form>
          )}
          {event.status === "published" && (
            <form action={unpublishBound}>
              <button className="rounded bg-neutral-200 px-3 py-1">Ukryj</button>
            </form>
          )}
          <form action={archiveBound}>
            <button className="rounded bg-neutral-200 px-3 py-1">Archiwizuj</button>
          </form>
        </div>
      </div>

      <form action={saveBound} className="mt-8 max-w-xl space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Tytuł</span>
          <input name="title" defaultValue={event.title} required maxLength={200} className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Opis</span>
          <textarea name="description" defaultValue={event.description ?? ""} rows={6} className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Miejsce</span>
          <input name="location" defaultValue={event.location ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Start</span>
            <input type="datetime-local" name="startsAt" defaultValue={toLocalInput(event.startsAt)} required className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Koniec</span>
            <input type="datetime-local" name="endsAt" defaultValue={toLocalInput(event.endsAt)} required className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Cena (PLN)</span>
            <input type="number" name="price" step="0.01" min="0" defaultValue={event.priceCents / 100} required className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Liczba miejsc</span>
            <input type="number" name="capacity" min="1" defaultValue={event.capacity} required className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">URL okładki</span>
          <input type="url" name="coverUrl" defaultValue={event.coverUrl ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Pytania do uczestnika</legend>
          <p className="text-xs text-neutral-500">Odpowiedzi zostaną zapisane razem ze zgłoszeniem.</p>
          <div className="mt-2">
            <CustomQuestionsEditor initial={questions} name="customQuestions" />
          </div>
        </fieldset>

        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-white">Zapisz</button>
      </form>

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Uczestnicy</h2>
            <a
              href={`/dashboard/events/${event.id}/export`}
              className="text-sm text-neutral-700 hover:underline"
            >
              Eksport CSV
            </a>
          </div>
          <ParticipantsSection eventId={event.id} questions={questions} />
        </section>
    </div>
  );
}

async function ParticipantsSection({
  eventId,
  questions,
}: {
  eventId: string;
  questions: CustomQuestion[];
}) {
  const { listParticipantsForEvent } = await import("@/lib/db/queries/participants");
  const all = await listParticipantsForEvent(eventId);

  const active = all.filter((p) => p.status !== "waitlisted");
  const waitlist = all.filter((p) => p.status === "waitlisted");

  return (
    <div>
      <ParticipantsTable participants={active} questions={questions} />
      {waitlist.length > 0 && (
        <>
          <h3 className="mt-8 text-sm font-semibold uppercase text-neutral-500">
            Lista rezerwowa ({waitlist.length})
          </h3>
          <ParticipantsTable participants={waitlist} questions={questions} />
        </>
      )}
    </div>
  );
}

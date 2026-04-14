import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer } from "@/lib/db/queries/events-dashboard";
import type { CustomQuestion } from "@/lib/validators/event";
import { parseParticipantFilterStatus } from "@/lib/participantFilterStatus";
import { EventDateTimeRange } from "@/components/dashboard/EventDateTimeRange";
import CustomQuestionsEditor from "@/components/dashboard/CustomQuestionsEditor";
import { ParticipantFilters } from "@/components/dashboard/ParticipantFilters";
import ParticipantsTable from "@/components/dashboard/ParticipantsTable";
import { Button, Input, Textarea, StatusBadge } from "@/components/ui";
import { saveEventAction, changeStatusAction } from "./actions";

export default async function EventEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status: statusParam } = await searchParams;
  const statusFilter = parseParticipantFilterStatus(statusParam);
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
          <StatusBadge status={event.status} />
          {event.status !== "published" && (
            <form action={publishBound}>
              <Button type="submit" variant="accent" size="sm">
                Opublikuj
              </Button>
            </form>
          )}
          {event.status === "published" && (
            <form action={unpublishBound}>
              <Button type="submit" variant="secondary" size="sm">
                Ukryj
              </Button>
            </form>
          )}
          <form action={archiveBound}>
            <Button type="submit" variant="secondary" size="sm">
              Archiwizuj
            </Button>
          </form>
        </div>
      </div>

      <form action={saveBound} className="mt-8 max-w-xl space-y-4">
        <Input name="title" label="Tytuł" defaultValue={event.title} required maxLength={200} />
        <Textarea name="description" label="Opis" defaultValue={event.description ?? ""} rows={6} />
        <Input name="location" label="Miejsce" defaultValue={event.location ?? ""} />
        <EventDateTimeRange defaultStartsAt={event.startsAt} defaultEndsAt={event.endsAt} />
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            name="price"
            label="Cena (PLN)"
            step="0.01"
            min="0"
            defaultValue={event.priceCents / 100}
            required
          />
          <Input
            type="number"
            name="capacity"
            label="Liczba miejsc"
            min="1"
            defaultValue={event.capacity}
            required
          />
        </div>
        <Input type="url" name="coverUrl" label="URL okładki" defaultValue={event.coverUrl ?? ""} />

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Pytania do uczestnika</legend>
          <p className="text-xs text-muted-foreground">Odpowiedzi zostaną zapisane razem ze zgłoszeniem.</p>
          <div className="mt-2">
            <CustomQuestionsEditor initial={questions} name="customQuestions" />
          </div>
        </fieldset>

        <Button type="submit">Zapisz</Button>
      </form>

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Uczestnicy</h2>
            <a
              href={`/dashboard/events/${event.id}/export`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              Eksport CSV
            </a>
          </div>
          <ParticipantsSection eventId={event.id} questions={questions} statusFilter={statusFilter} />
        </section>
    </div>
  );
}

async function ParticipantsSection({
  eventId,
  questions,
  statusFilter,
}: {
  eventId: string;
  questions: CustomQuestion[];
  statusFilter: ReturnType<typeof parseParticipantFilterStatus>;
}) {
  const { listParticipantsForEvent } = await import("@/lib/db/queries/participants");
  const all = await listParticipantsForEvent(eventId);

  const active = all.filter((p) => p.status !== "waitlisted");
  const filtered =
    statusFilter === "all"
      ? active
      : active.filter((p) => p.status === statusFilter);
  const waitlist = all.filter((p) => p.status === "waitlisted");

  return (
    <div>
      <Suspense fallback={<div className="mt-4 h-8" aria-hidden />}>
        <ParticipantFilters current={statusFilter} />
      </Suspense>
      <ParticipantsTable
        participants={filtered}
        questions={questions}
        emptyMessage={statusFilter === "all" ? undefined : "Brak zgłoszeń w tej kategorii."}
      />
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

import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer } from "@/lib/db/queries/events-dashboard";
import type { CustomQuestion } from "@/lib/validators/event";
import { parseParticipantFilterStatus } from "@/lib/participantFilterStatus";
import { ParticipantFilters } from "@/components/dashboard/ParticipantFilters";
import ParticipantsTable from "@/components/dashboard/ParticipantsTable";
import { Button, StatusBadge, SubmitButton } from "@/components/ui";
import { changeStatusAction } from "./actions";
import { EventEditForm } from "./EventEditForm";

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

  const publishBound = changeStatusAction.bind(null, id, "published");
  const unpublishBound = changeStatusAction.bind(null, id, "draft");
  const archiveBound = changeStatusAction.bind(null, id, "archived");

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const previewUrl = `https://${organizer.subdomain}.${rootDomain}/${event.slug}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <div className="flex items-center gap-2 text-sm">
          <StatusBadge status={event.status} />
          <Button
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="sm"
          >
            Podgląd
          </Button>
          {event.status !== "published" && (
            <form action={publishBound}>
              <SubmitButton variant="accent" size="sm">
                Opublikuj
              </SubmitButton>
            </form>
          )}
          {event.status === "published" && (
            <form action={unpublishBound}>
              <SubmitButton variant="secondary" size="sm">
                Ukryj
              </SubmitButton>
            </form>
          )}
          <form action={archiveBound}>
            <SubmitButton variant="secondary" size="sm">
              Archiwizuj
            </SubmitButton>
          </form>
        </div>
      </div>

      <EventEditForm
        eventId={id}
        event={{
          title: event.title,
          description: event.description,
          location: event.location,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          priceCents: event.priceCents,
          capacity: event.capacity,
          coverUrl: event.coverUrl,
        }}
        initialQuestions={questions}
      />

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Uczestnicy</h2>
            <a
              href={`/dashboard/events/${event.id}/export`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
              aria-label="Eksportuj uczestników do CSV"
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

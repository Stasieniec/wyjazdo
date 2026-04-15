import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer } from "@/lib/db/queries/events-dashboard";
import type { CustomQuestion } from "@/lib/validators/event";
import { parseEventDashboardTab } from "@/lib/eventDashboardTab";
import { parseParticipantFilterStatus } from "@/lib/participantFilterStatus";
import { ParticipantFilters } from "@/components/dashboard/ParticipantFilters";
import ParticipantsTable from "@/components/dashboard/ParticipantsTable";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { Button, Card, StatusBadge, SubmitButton } from "@/components/ui";
import { publicEventUrl } from "@/lib/urls";
import { changeStatusAction } from "./actions";
import { EventEditForm } from "./EventEditForm";

export default async function EventEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { status: statusParam, tab: tabParam } = await searchParams;
  const dashboardTab = parseEventDashboardTab(tabParam);
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
  const stripeReady =
    organizer.stripeOnboardingComplete === 1 && organizer.stripePayoutsEnabled === 1;

  const previewUrl = publicEventUrl(organizer.subdomain, event.slug);
  const editHref = `/dashboard/events/${id}`;
  const participantsHref = `/dashboard/events/${id}?tab=uczestnicy`;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={event.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{event.title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm sm:justify-end">
          {event.status === "published" ? (
            <>
              <Button
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="ghost"
                size="sm"
              >
                Podgląd
              </Button>
              <CopyLinkButton url={previewUrl} />
              <form action={unpublishBound}>
                <SubmitButton variant="secondary" size="sm">
                  Ukryj
                </SubmitButton>
              </form>
            </>
          ) : (
            <>
              <form action={publishBound}>
                <SubmitButton
                  variant="accent"
                  size="sm"
                  disabled={!stripeReady}
                  title={
                    !stripeReady
                      ? "Dokończ konfigurację Stripe, aby opublikować wydarzenie"
                      : undefined
                  }
                >
                  Opublikuj
                </SubmitButton>
              </form>
              {!stripeReady && (
                <Link
                  href="/dashboard/onboarding/payouts"
                  className="text-xs text-yellow-700 underline"
                >
                  Dokończ konfigurację Stripe
                </Link>
              )}
            </>
          )}
          {event.status !== "archived" && (
            <form action={archiveBound}>
              <SubmitButton variant="ghost" size="sm">
                Archiwizuj
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {/* Status hint */}
      {event.status === "draft" && (
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">To jest szkic.</strong>{" "}
          Tylko Ty widzisz tę stronę. Kliknij <em>Opublikuj</em>, aby inni mogli się zapisać.
        </div>
      )}
      {event.status === "archived" && (
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Zarchiwizowane.</strong>{" "}
          Wydarzenie nie jest już widoczne publicznie. Nadal możesz zobaczyć listę uczestników.
        </div>
      )}

      {/* View switcher: edycja vs uczestnicy */}
      <nav
        className="mt-6 flex gap-1 rounded-xl border border-border bg-muted/40 p-1"
        aria-label="Widok wydarzenia"
      >
        <Link
          href={editHref}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-5 ${
            dashboardTab === "edycja"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-current={dashboardTab === "edycja" ? "page" : undefined}
        >
          Edycja
        </Link>
        <Link
          href={participantsHref}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-5 ${
            dashboardTab === "uczestnicy"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-current={dashboardTab === "uczestnicy" ? "page" : undefined}
        >
          Uczestnicy
        </Link>
      </nav>

      {dashboardTab === "edycja" ? (
        <div className="mt-6">
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
        </div>
      ) : (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Lista zgłoszeń</h2>
            <a
              href={`/dashboard/events/${event.id}/export`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Eksportuj uczestników do CSV"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
                className="h-3.5 w-3.5"
              >
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.41a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.128V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              Eksport CSV
            </a>
          </div>
          <div className="mt-4">
            <ParticipantsSection eventId={event.id} questions={questions} statusFilter={statusFilter} />
          </div>
        </section>
      )}
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
  const { listPaymentsForParticipants } = await import("@/lib/db/queries/payments");
  const { derivedStatus } = await import("@/lib/participant-status");
  const all = await listParticipantsForEvent(eventId);
  const allPayments = await listPaymentsForParticipants(all.map((p) => p.id));
  const now = Date.now();

  const paymentsByParticipant = new Map<string, typeof allPayments>();
  for (const pay of allPayments) {
    const list = paymentsByParticipant.get(pay.participantId) ?? [];
    list.push(pay);
    paymentsByParticipant.set(pay.participantId, list);
  }

  const active = all.filter((p) => p.lifecycleStatus !== "waitlisted");
  const filtered =
    statusFilter === "all"
      ? active
      : active.filter((p) => {
          const ds = derivedStatus(p, paymentsByParticipant.get(p.id) ?? [], now);
          return ds === statusFilter;
        });
  const waitlist = all.filter((p) => p.lifecycleStatus === "waitlisted");

  if (all.length === 0) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-sm text-muted-foreground">
          Brak zgłoszeń. Jak tylko ktoś się zapisze, pojawi się tutaj.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <Suspense fallback={<div className="h-8" aria-hidden />}>
        <ParticipantFilters current={statusFilter} />
      </Suspense>
      <ParticipantsTable
        participants={filtered}
        payments={allPayments}
        questions={questions}
        emptyMessage={statusFilter === "all" ? undefined : "Brak zgłoszeń w tej kategorii."}
      />
      {waitlist.length > 0 && (
        <>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Lista rezerwowa ({waitlist.length})
          </h3>
          <ParticipantsTable participants={waitlist} payments={allPayments} questions={questions} />
        </>
      )}
    </div>
  );
}

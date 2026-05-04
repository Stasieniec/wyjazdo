import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer } from "@/lib/db/queries/events-dashboard";
import { listPhotosForEvent } from "@/lib/db/queries/event-photos";
import { isStepIdValid, type StepId } from "@/lib/wizard/event-creation-steps";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { EventCreationWizard } from "./EventCreationWizard";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; eventId?: string }>;
}) {
  const sp = await searchParams;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/onboarding");

  const eventId = sp.eventId ?? null;
  let initialEvent = null;
  if (eventId) {
    initialEvent = await getEventForOrganizer(organizer.id, eventId);
    if (!initialEvent) redirect("/dashboard");
    if (initialEvent.status !== "draft" || initialEvent.creationStep === "complete") {
      redirect(`/dashboard/events/${eventId}`);
    }
  }

  // Resolve the step. Default to first step (tytul) for fresh starts.
  // If user passed ?step=… that's beyond their saved progress, redirect to their saved step.
  const requestedStep = isStepIdValid(sp.step) ? sp.step : "tytul";
  let activeStep: StepId = requestedStep;
  if (initialEvent && initialEvent.creationStep && initialEvent.creationStep !== "complete") {
    // Don't let user skip past their progress
    activeStep = isStepIdValid(initialEvent.creationStep)
      ? (initialEvent.creationStep as StepId)
      : requestedStep;
  }

  const galleryPhotos = eventId ? await listPhotosForEvent(eventId) : [];
  const attendeeTypes: AttendeeType[] | null = initialEvent?.attendeeTypes
    ? JSON.parse(initialEvent.attendeeTypes)
    : null;

  return (
    <EventCreationWizard
      subdomain={organizer.subdomain}
      rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl"}
      initialStep={activeStep}
      initialEvent={{
        id: eventId,
        title: initialEvent?.title ?? "",
        slug: initialEvent?.slug ?? "",
        description: initialEvent?.description ?? null,
        location: initialEvent?.location ?? null,
        startsAt: initialEvent?.startsAt ?? null,
        endsAt: initialEvent?.endsAt ?? null,
        attendeeTypes,
        capacity: initialEvent?.capacity ?? 1,
        depositCents: initialEvent?.depositCents ?? null,
        balanceDueAt: initialEvent?.balanceDueAt ?? null,
        coverUrl: initialEvent?.coverUrl ?? null,
        galleryPhotos: galleryPhotos.map((p) => ({ url: p.url, position: p.position })),
        customQuestions: initialEvent?.customQuestions ? JSON.parse(initialEvent.customQuestions) : [],
        consentConfig: initialEvent?.consentConfig ? JSON.parse(initialEvent.consentConfig) : [],
      }}
    />
  );
}

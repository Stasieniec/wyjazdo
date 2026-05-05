import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer } from "@/lib/db/queries/events-dashboard";
import { listPhotosForEvent } from "@/lib/db/queries/event-photos";
import { isStepIdValid, visibleStepsFor, type StepId } from "@/lib/wizard/event-creation-steps";
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

  const galleryPhotos = eventId ? await listPhotosForEvent(eventId) : [];
  const attendeeTypes: AttendeeType[] | null = initialEvent?.attendeeTypes
    ? JSON.parse(initialEvent.attendeeTypes)
    : null;

  // URL drives the step. The saved creationStep is a forward-progress watermark:
  // we honor backward navigation freely, but clamp skip-ahead requests back to the watermark.
  const requestedStep: StepId = isStepIdValid(sp.step) ? (sp.step as StepId) : "tytul";
  let activeStep: StepId = requestedStep;
  if (
    initialEvent &&
    initialEvent.creationStep &&
    initialEvent.creationStep !== "complete" &&
    isStepIdValid(initialEvent.creationStep)
  ) {
    const savedStep = initialEvent.creationStep as StepId;
    const visible = visibleStepsFor(attendeeTypes);
    const savedIdx = visible.indexOf(savedStep);
    const requestedIdx = visible.indexOf(requestedStep);
    if (savedIdx !== -1 && requestedIdx > savedIdx) {
      activeStep = savedStep;
    }
  }

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

"use client";

import { SectionRail } from "./SectionRail";
import { SectionSheet } from "./SectionSheet";
import { computeSectionStatus, isPublishable, type EventForStatus } from "./section-status";
import { SectionBasics } from "./sections/SectionBasics";
import { SectionDates } from "./sections/SectionDates";
import { SectionLocation } from "./sections/SectionLocation";
import { SectionAttendees } from "./sections/SectionAttendees";
import { SectionCapacity } from "./sections/SectionCapacity";
import { SectionPayment } from "./sections/SectionPayment";
import { SectionPhotos } from "./sections/SectionPhotos";
import { SectionQuestions } from "./sections/SectionQuestions";
import { SectionConsents } from "./sections/SectionConsents";
import { PublishControls } from "./PublishControls";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";

type FullEvent = EventForStatus & {
  status: "draft" | "published" | "archived";
  creationStep: string | null;
  publishedAt: number | null;
};

type Props = {
  eventId: string;
  event: FullEvent;
  galleryPhotos: { url: string; position: number }[];
  attendeeTypes: AttendeeType[] | null;
  customQuestions: CustomQuestion[];
  consents: ConsentConfigItem[];
  subdomain: string;
  rootDomain: string;
  stripeReady: boolean;
};

export function EventEditView({
  eventId,
  event,
  galleryPhotos,
  attendeeTypes,
  customQuestions,
  consents,
  subdomain,
  rootDomain,
  stripeReady,
}: Props) {
  const status = computeSectionStatus(event, galleryPhotos);
  const publishCheck = isPublishable(event, galleryPhotos);
  const showPostWizardBanner =
    event.creationStep === "complete" &&
    event.status === "draft" &&
    event.publishedAt === null;

  const publishSlot = (
    <PublishControls
      eventId={eventId}
      eventStatus={event.status}
      stripeReady={stripeReady}
      publishable={publishCheck.ok}
      missing={publishCheck.ok ? [] : publishCheck.missing}
    />
  );

  return (
    <div>
      <SectionSheet status={status} publishSlot={publishSlot} />
      <div className="flex gap-6">
        <SectionRail status={status} publishSlot={publishSlot} />
        <main className="min-w-0 flex-1 space-y-6">
          {showPostWizardBanner && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm">
                <strong>✓ Wszystko gotowe — sprawdź szczegóły i kliknij Opublikuj.</strong>
                {!stripeReady && " Najpierw dokończ konfigurację Stripe."}
              </p>
            </div>
          )}
          <SectionBasics
            eventId={eventId}
            subdomain={subdomain}
            rootDomain={rootDomain}
            initial={{
              title: event.title,
              slug: event.slug,
              description: event.description ?? "",
            }}
          />
          <SectionDates
            eventId={eventId}
            initial={{ startsAt: event.startsAt, endsAt: event.endsAt }}
          />
          <SectionLocation
            eventId={eventId}
            initial={{ location: event.location ?? "" }}
          />
          <SectionAttendees eventId={eventId} initialAttendeeTypes={attendeeTypes} />
          <SectionCapacity eventId={eventId} initial={{ capacity: event.capacity }} />
          <SectionPayment
            eventId={eventId}
            initial={{
              depositCents: event.depositCents,
              balanceDueAt: event.balanceDueAt,
            }}
            isFree={status.platnosc === "free"}
          />
          <SectionPhotos
            eventId={eventId}
            coverUrl={event.coverUrl}
            galleryPhotos={galleryPhotos}
          />
          <SectionQuestions
            eventId={eventId}
            attendeeTypes={attendeeTypes}
            initialCustomQuestions={customQuestions}
          />
          <SectionConsents eventId={eventId} initial={consents} />
        </main>
      </div>
    </div>
  );
}

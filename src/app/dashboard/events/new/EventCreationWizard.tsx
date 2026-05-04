"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { WizardShell } from "@/app/onboarding/WizardShell";
import { visibleStepsFor, type StepId } from "@/lib/wizard/event-creation-steps";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import {
  saveStepTitleAction,
  saveStepDescriptionAction,
  saveStepDatesAction,
  saveStepLocationAction,
  saveStepAttendeesAction,
  saveStepCapacityAction,
  saveStepPaymentAction,
  saveStepPhotosAction,
  saveStepQuestionsAction,
  saveStepConsentsAction,
  type StepResult,
} from "./wizard-actions";
import { StepTitle } from "./steps/StepTitle";
import { StepDescription } from "./steps/StepDescription";
import { StepDates } from "./steps/StepDates";
import { StepLocation } from "./steps/StepLocation";
import { StepAttendees } from "./steps/StepAttendees";
import { StepCapacity } from "./steps/StepCapacity";
import { StepPayment } from "./steps/StepPayment";
import { StepPhotos } from "./steps/StepPhotos";
import { StepQuestions } from "./steps/StepQuestions";
import { StepConsents } from "./steps/StepConsents";

type SeedEvent = {
  id: string | null;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  startsAt: number | null;
  endsAt: number | null;
  attendeeTypes: AttendeeType[] | null;
  capacity: number;
  depositCents: number | null;
  balanceDueAt: number | null;
  coverUrl: string | null;
  galleryPhotos: { url: string; position: number }[];
  customQuestions: CustomQuestion[];
  consentConfig: ConsentConfigItem[];
};

type Props = {
  subdomain: string;
  rootDomain: string;
  initialStep: StepId;
  initialEvent: SeedEvent;
};

export function EventCreationWizard({ subdomain, rootDomain, initialStep, initialEvent }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const eventId = initialEvent.id;
  const visible = visibleStepsFor(initialEvent.attendeeTypes);
  const stepIndex = Math.max(1, visible.indexOf(initialStep) + 1);
  const totalSteps = visible.length;

  function navigateToStep(next: StepId) {
    setErrors({});
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("step", next);
    if (eventId) sp.set("eventId", eventId);
    router.push(`/dashboard/events/new?${sp.toString()}`);
  }

  function handleResult(result: StepResult) {
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    if (result.nextStep === "complete") {
      router.push(`/dashboard/events/${result.eventId}`);
      return;
    }
    navigateToStep(result.nextStep);
  }

  function back() {
    if (stepIndex <= 1) return;
    const prev = visible[stepIndex - 2];
    navigateToStep(prev);
  }

  function renderStep() {
    switch (initialStep) {
      case "tytul":
        return (
          <StepTitle
            subdomain={subdomain}
            rootDomain={rootDomain}
            defaultTitle={initialEvent.title}
            defaultSlug={initialEvent.slug}
            errors={errors}
            pending={pending}
            onBack={() => router.push("/dashboard")}
            onNext={(title, slug) =>
              startTransition(async () => {
                const fd = new FormData();
                fd.set("title", title);
                fd.set("slug", slug);
                handleResult(await saveStepTitleAction(eventId, fd));
              })
            }
          />
        );
      case "opis":
        return (
          <StepDescription
            defaultValue={initialEvent.description ?? ""}
            error={errors.description}
            pending={pending}
            onBack={back}
            onNext={(value) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("description", value);
                handleResult(await saveStepDescriptionAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepDescriptionAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "termin":
        return (
          <StepDates
            defaultStartsAt={initialEvent.startsAt ?? undefined}
            defaultEndsAt={initialEvent.endsAt ?? undefined}
            error={errors.startsAt ?? errors.endsAt}
            pending={pending}
            onBack={back}
            onNext={(starts, ends) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("startsAt", new Date(starts).toISOString());
                fd.set("endsAt", new Date(ends).toISOString());
                handleResult(await saveStepDatesAction(eventId, fd));
              })
            }
          />
        );
      case "miejsce":
        return (
          <StepLocation
            defaultValue={initialEvent.location ?? ""}
            error={errors.location}
            pending={pending}
            onBack={back}
            onNext={(value) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("location", value);
                handleResult(await saveStepLocationAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepLocationAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "uczestnicy":
        return (
          <StepAttendees
            defaultAttendeeTypes={initialEvent.attendeeTypes}
            error={errors.attendeeTypes}
            pending={pending}
            onBack={back}
            onNext={(json) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("attendeeTypes", json);
                handleResult(await saveStepAttendeesAction(eventId, fd));
              })
            }
          />
        );
      case "miejsca":
        return (
          <StepCapacity
            defaultValue={initialEvent.capacity}
            error={errors.capacity}
            pending={pending}
            onBack={back}
            onNext={(value) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("capacity", String(value));
                handleResult(await saveStepCapacityAction(eventId, fd));
              })
            }
          />
        );
      case "platnosc":
        return (
          <StepPayment
            defaultDepositCents={initialEvent.depositCents}
            defaultBalanceDueAt={initialEvent.balanceDueAt}
            errors={{ depositCents: errors.depositCents, balanceDueAt: errors.balanceDueAt }}
            pending={pending}
            onBack={back}
            onNext={(depositOn, depositCents, balanceDueAtMs) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("depositOn", depositOn ? "true" : "");
                if (depositCents != null) fd.set("deposit", String(depositCents / 100));
                if (balanceDueAtMs != null) fd.set("balanceDueAt", new Date(balanceDueAtMs).toISOString());
                handleResult(await saveStepPaymentAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepPaymentAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "zdjecia":
        return (
          <StepPhotos
            defaultCoverUrl={initialEvent.coverUrl}
            defaultGalleryPhotos={initialEvent.galleryPhotos}
            pending={pending}
            onBack={back}
            onNext={(coverUrl, galleryJson) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("coverUrl", coverUrl);
                fd.set("galleryPhotos", galleryJson);
                handleResult(await saveStepPhotosAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepPhotosAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "pytania":
        return (
          <StepQuestions
            attendeeTypes={initialEvent.attendeeTypes}
            defaultRegistrationQuestions={initialEvent.customQuestions}
            pending={pending}
            onBack={back}
            onNext={(regQuestionsJson, perTypeJson) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("customQuestions", regQuestionsJson);
                for (const [typeId, json] of Object.entries(perTypeJson)) {
                  fd.set(`customFields:${typeId}`, json);
                }
                handleResult(await saveStepQuestionsAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepQuestionsAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "zgody":
        return (
          <StepConsents
            defaultConsents={initialEvent.consentConfig}
            pending={pending}
            onBack={back}
            onNext={(consentsJson) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("consentConfig", consentsJson);
                await saveStepConsentsAction(eventId, fd);
                // Action redirects on success.
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                await saveStepConsentsAction(eventId, new FormData(), true);
                // Action redirects on success.
              })
            }
          />
        );
      default:
        return null;
    }
  }

  return (
    <WizardShell currentStep={stepIndex} totalSteps={totalSteps}>
      {renderStep()}
    </WizardShell>
  );
}

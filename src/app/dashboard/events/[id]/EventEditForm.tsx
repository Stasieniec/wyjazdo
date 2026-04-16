"use client";

import { useActionState } from "react";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import CustomQuestionsEditor from "@/components/dashboard/CustomQuestionsEditor";
import EventConsentsEditor from "@/components/dashboard/EventConsentsEditor";
import { EventDateTimeRange } from "@/components/dashboard/EventDateTimeRange";
import { Card, ImageUpload, Input, SubmitButton, Textarea } from "@/components/ui";
import { GalleryUpload } from "@/components/dashboard/GalleryUpload";
import { saveEventAction, type SaveEventFormState } from "./actions";

type Props = {
  eventId: string;
  /** Draft-only: show "krok 2" onboarding after creating from the wizard. */
  showCreationStep2?: boolean;
  event: {
    title: string;
    description: string | null;
    location: string | null;
    startsAt: number;
    endsAt: number;
    priceCents: number;
    capacity: number;
    coverUrl: string | null;
    depositCents: number | null;
    balanceDueAt: number | null;
  };
  initialQuestions: CustomQuestion[];
  initialConsents: ConsentConfigItem[];
  initialPhotos: { url: string; position: number }[];
};

export function EventEditForm({
  eventId,
  event,
  initialQuestions,
  initialConsents,
  initialPhotos,
  showCreationStep2 = false,
}: Props) {
  const [state, formAction] = useActionState<SaveEventFormState, FormData>(
    saveEventAction.bind(null, eventId),
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      {showCreationStep2 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Krok 2 z 2: Dopracuj wydarzenie
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tutaj możesz zmieniać szczegóły, dodać pytania do uczestników i — gdy będzie
            gotowe — opublikować wydarzenie.
          </p>
        </div>
      )}
      <Section title="Podstawowe informacje">
        <Input
          name="title"
          label="Tytuł"
          defaultValue={event.title}
          required
          maxLength={200}
          error={state?.errors?.title}
        />
        <Textarea
          name="description"
          label="Opis"
          defaultValue={event.description ?? ""}
          rows={6}
          error={state?.errors?.description}
        />
        <Input
          name="location"
          label="Miejsce"
          defaultValue={event.location ?? ""}
          error={state?.errors?.location}
        />
      </Section>

      <Section title="Termin i miejsca">
        <EventDateTimeRange
          defaultStartsAt={event.startsAt}
          defaultEndsAt={event.endsAt}
          error={state?.errors?.startsAt ?? state?.errors?.endsAt}
        />
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Cena całkowita</span> to kwota,
            którą uczestnik zapłaci łącznie za udział.{" "}
            <span className="font-medium text-foreground">Zaliczka</span> to pierwsza część
            tej kwoty (płatna przy zapisie), a nie dodatkowa opłata obok ceny.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            type="number"
            name="price"
            label="Cena całkowita (PLN)"
            step="0.01"
            min="0"
            defaultValue={event.priceCents / 100}
            required
            error={state?.errors?.price ?? state?.errors?.priceCents}
          />
          <Input
            type="number"
            name="capacity"
            label="Liczba miejsc"
            min="1"
            defaultValue={event.capacity}
            required
            error={state?.errors?.capacity}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Input
              type="number"
              name="deposit"
              label="Zaliczka przy zapisie (PLN) — opcjonalnie"
              step="0.01"
              min="0"
              defaultValue={
                event.depositCents != null ? event.depositCents / 100 : undefined
              }
              error={state?.errors?.depositCents}
            />
            <p className="text-xs text-muted-foreground">
              Część ceny całkowitej płatna od razu. Puste = cała kwota przy rejestracji.
            </p>
          </div>
          <div className="space-y-1">
            <Input
              type="datetime-local"
              name="balanceDueAt"
              label="Termin dopłaty reszty — opcjonalnie"
              defaultValue={
                event.balanceDueAt != null
                  ? new Date(event.balanceDueAt - new Date(event.balanceDueAt).getTimezoneOffset() * 60_000)
                      .toISOString()
                      .slice(0, 16)
                  : undefined
              }
              error={state?.errors?.balanceDueAt}
            />
            <p className="text-xs text-muted-foreground">
              Gdy zaliczka jest niższa niż cena całkowita — kiedy ma być dopłata reszty.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Okładka">
        <ImageUpload
          name="coverUrl"
          label="Zdjęcie okładki"
          defaultValue={event.coverUrl}
          aspect="cover"
          error={state?.errors?.coverUrl}
        />
      </Section>

      <Section title="Galeria zdjęć" description="Dodaj do 5 zdjęć prezentujących wydarzenie — np. miejsce, poprzednie edycje, atrakcje.">
        <GalleryUpload
          name="galleryPhotos"
          defaultValue={initialPhotos}
          max={5}
          error={state?.errors?.galleryPhotos}
        />
      </Section>

      <Section
        title="Pytania do uczestnika"
        description="Dodatkowe informacje zbierane w formularzu zapisu — np. preferencje żywieniowe, rozmiar koszulki, kontakt awaryjny."
      >
        {state?.errors?.customQuestions && (
          <p className="text-sm text-destructive" role="alert">
            {state.errors.customQuestions}
          </p>
        )}
        <CustomQuestionsEditor initial={initialQuestions} name="customQuestions" />
      </Section>

      <Section
        title="Zgody i regulaminy"
        description="Zgody platformy są obowiązkowe i wyświetlane automatycznie. Możesz dodać własne zgody, np. na wykorzystanie wizerunku, przetwarzanie danych o zdrowiu lub akceptację regulaminu wydarzenia."
      >
        {state?.errors?.consentConfig && (
          <p className="text-sm text-destructive" role="alert">
            {state.errors.consentConfig}
          </p>
        )}
        <EventConsentsEditor initial={initialConsents} name="consentConfig" />
      </Section>

      <div className="flex items-center gap-4">
        <SubmitButton>Zapisz zmiany</SubmitButton>
        {state && !state.errors && (
          <p className="text-sm text-success">Zmiany zostały zapisane.</p>
        )}
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

"use client";

import { useActionState } from "react";
import type { CustomQuestion } from "@/lib/validators/event";
import CustomQuestionsEditor from "@/components/dashboard/CustomQuestionsEditor";
import { EventDateTimeRange } from "@/components/dashboard/EventDateTimeRange";
import { Card, ImageUpload, Input, SubmitButton, Textarea } from "@/components/ui";
import { saveEventAction, type SaveEventFormState } from "./actions";

type Props = {
  eventId: string;
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
};

export function EventEditForm({ eventId, event, initialQuestions }: Props) {
  const [state, formAction] = useActionState<SaveEventFormState, FormData>(
    saveEventAction.bind(null, eventId),
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            type="number"
            name="price"
            label="Cena (PLN)"
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
              label="Zaliczka (zł) — opcjonalnie"
              step="0.01"
              min="0"
              defaultValue={
                event.depositCents != null ? event.depositCents / 100 : undefined
              }
              error={state?.errors?.depositCents}
            />
            <p className="text-xs text-muted-foreground">
              Jeśli zostawisz puste, wymagana będzie pełna płatność przy rejestracji.
            </p>
          </div>
          <div className="space-y-1">
            <Input
              type="datetime-local"
              name="balanceDueAt"
              label="Termin dopłaty — opcjonalnie"
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
              Wymagane, gdy zaliczka jest niższa niż cena.
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

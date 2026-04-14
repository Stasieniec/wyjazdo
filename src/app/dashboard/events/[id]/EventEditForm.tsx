"use client";

import { useActionState } from "react";
import type { CustomQuestion } from "@/lib/validators/event";
import CustomQuestionsEditor from "@/components/dashboard/CustomQuestionsEditor";
import { EventDateTimeRange } from "@/components/dashboard/EventDateTimeRange";
import { Button, Input, Textarea } from "@/components/ui";
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
  };
  initialQuestions: CustomQuestion[];
};

export function EventEditForm({ eventId, event, initialQuestions }: Props) {
  const [state, formAction, pending] = useActionState<SaveEventFormState, FormData>(
    saveEventAction.bind(null, eventId),
    null,
  );

  return (
    <form action={formAction} className="mt-8 max-w-xl space-y-4">
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
      <EventDateTimeRange
        defaultStartsAt={event.startsAt}
        defaultEndsAt={event.endsAt}
        error={state?.errors?.startsAt ?? state?.errors?.endsAt}
      />
      <div className="grid grid-cols-2 gap-4">
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
      <Input
        type="url"
        name="coverUrl"
        label="URL okładki"
        defaultValue={event.coverUrl ?? ""}
        error={state?.errors?.coverUrl}
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Pytania do uczestnika</legend>
        <p className="text-xs text-muted-foreground">Odpowiedzi zostaną zapisane razem ze zgłoszeniem.</p>
        {state?.errors?.customQuestions && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {state.errors.customQuestions}
          </p>
        )}
        <div className="mt-2">
          <CustomQuestionsEditor initial={initialQuestions} name="customQuestions" />
        </div>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Zapisywanie..." : "Zapisz"}
      </Button>
    </form>
  );
}

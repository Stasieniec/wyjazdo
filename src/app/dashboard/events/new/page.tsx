"use client";

import { useActionState } from "react";
import { EventDateTimeRange } from "@/components/dashboard/EventDateTimeRange";
import { Input, SubmitButton, Textarea } from "@/components/ui";
import { createEventAction, type CreateEventFormState } from "./actions";

export default function NewEventPage() {
  const [state, formAction] = useActionState<CreateEventFormState, FormData>(
    createEventAction,
    null,
  );

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Nowe wydarzenie</h1>
      <form action={formAction} className="mt-8 space-y-4">
        <Input
          name="title"
          label="Tytuł"
          required
          maxLength={200}
          error={state?.errors?.title}
        />
        <Input
          name="slug"
          label="Nazwa w URL"
          required
          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          minLength={3}
          maxLength={64}
          placeholder="np. warsztaty-kwietniowe"
          error={state?.errors?.slug}
        />
        <Textarea name="description" label="Opis" rows={4} error={state?.errors?.description} />
        <Input name="location" label="Miejsce" error={state?.errors?.location} />
        <EventDateTimeRange
          error={state?.errors?.startsAt ?? state?.errors?.endsAt}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            type="number"
            name="price"
            label="Cena (PLN)"
            step="0.01"
            min="0"
            required
            error={state?.errors?.price ?? state?.errors?.priceCents}
          />
          <Input
            type="number"
            name="capacity"
            label="Liczba miejsc"
            min="1"
            required
            error={state?.errors?.capacity}
          />
        </div>
        <Input
          type="url"
          name="coverUrl"
          label="URL okładki (opcjonalnie)"
          error={state?.errors?.coverUrl}
        />

        {state?.errors?._form && (
          <p className="text-sm text-destructive" role="alert">
            {state.errors._form}
          </p>
        )}

        <SubmitButton>Utwórz jako szkic</SubmitButton>
      </form>
    </div>
  );
}

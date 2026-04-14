"use client";

import { useActionState } from "react";
import { EventDateTimeRange } from "@/components/dashboard/EventDateTimeRange";
import { Input, SubmitButton, Textarea } from "@/components/ui";
import { createEventAction } from "./actions";

export default function NewEventPage() {
  const [state, formAction] = useActionState<{ error?: string } | null, FormData>(
    async (_prev, formData) => (await createEventAction(formData)) ?? null,
    null,
  );

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Nowe wydarzenie</h1>
      <form action={formAction} className="mt-8 space-y-4">
        <Input name="title" label="Tytuł" required maxLength={200} />
        <Input
          name="slug"
          label="Nazwa w URL"
          required
          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          minLength={3}
          maxLength={64}
          placeholder="np. warsztaty-kwietniowe"
        />
        <Textarea name="description" label="Opis" rows={4} />
        <Input name="location" label="Miejsce" />
        <EventDateTimeRange />
        <div className="grid grid-cols-2 gap-4">
          <Input type="number" name="price" label="Cena (PLN)" step="0.01" min="0" required />
          <Input type="number" name="capacity" label="Liczba miejsc" min="1" required />
        </div>
        <Input type="url" name="coverUrl" label="URL okładki (opcjonalnie)" />

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton>Utwórz jako szkic</SubmitButton>
      </form>
    </div>
  );
}

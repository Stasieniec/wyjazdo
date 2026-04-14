"use client";

import { useActionState } from "react";
import { DateTimePickerField } from "@/components/dashboard/DateTimePickerField";
import { createEventAction } from "./actions";

export default function NewEventPage() {
  const [state, formAction, pending] = useActionState<{ error?: string } | null, FormData>(
    async (_prev, formData) => (await createEventAction(formData)) ?? null,
    null,
  );

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Nowe wydarzenie</h1>
      <form action={formAction} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Tytuł</span>
          <input name="title" required maxLength={200} className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Nazwa w URL</span>
          <input
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
            minLength={3}
            maxLength={64}
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="np. warsztaty-kwietniowe"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Opis</span>
          <textarea name="description" rows={4} className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Miejsce</span>
          <input name="location" className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateTimePickerField name="startsAt" label="Start" />
          <DateTimePickerField name="endsAt" label="Koniec" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Cena (PLN)</span>
            <input type="number" name="price" step="0.01" min="0" required className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Liczba miejsc</span>
            <input type="number" name="capacity" min="1" required className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">URL okładki (opcjonalnie)</span>
          <input type="url" name="coverUrl" className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending} className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
          {pending ? "Zapisywanie..." : "Utwórz jako szkic"}
        </button>
      </form>
    </div>
  );
}

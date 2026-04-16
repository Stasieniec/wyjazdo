"use client";

import { useActionState } from "react";
import { EventDateTimeRange } from "@/components/dashboard/EventDateTimeRange";
import { Card, ImageUpload, Input, SubmitButton, Textarea } from "@/components/ui";
import { createEventAction, type CreateEventFormState } from "./actions";

export default function NewEventPage() {
  const [state, formAction] = useActionState<CreateEventFormState, FormData>(
    createEventAction,
    null,
  );

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Krok 1 z 2: Detale
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Nowe wydarzenie</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Uzupełnij podstawowe informacje. Po kliknięciu <em>Kontynuuj</em> przejdziesz do
        edycji — tam dodasz pytania do uczestników i opublikujesz wydarzenie, gdy będzie
        gotowe. Na razie widzisz tylko Ty (szkic).
      </p>
      <Card className="mt-6">
        <form action={formAction} className="space-y-4">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Input
                type="number"
                name="deposit"
                label="Zaliczka przy zapisie (PLN) — opcjonalnie"
                step="0.01"
                min="0"
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
                error={state?.errors?.balanceDueAt}
              />
              <p className="text-xs text-muted-foreground">
                Gdy zaliczka jest niższa niż cena całkowita — kiedy ma być dopłata reszty.
              </p>
            </div>
          </div>
          <ImageUpload
            name="coverUrl"
            label="Zdjęcie okładki (opcjonalnie)"
            aspect="cover"
            error={state?.errors?.coverUrl}
          />

          {state?.errors?._form && (
            <p className="text-sm text-destructive" role="alert">
              {state.errors._form}
            </p>
          )}

          <SubmitButton>Kontynuuj</SubmitButton>
        </form>
      </Card>
    </div>
  );
}

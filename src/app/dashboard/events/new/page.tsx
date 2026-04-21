"use client";

import { useActionState, useMemo, useState } from "react";
import { EventDateTimeRange } from "@/components/dashboard/EventDateTimeRange";
import { GalleryUpload } from "@/components/dashboard/GalleryUpload";
import { Card, ImageUpload, Input, SubmitButton, Textarea } from "@/components/ui";
import { createEventAction, type CreateEventFormState } from "./actions";
import { AttendeeTypesField } from "../[id]/attendee-types-field";

function NewEventPricingFields({
  seed,
  errors,
}: {
  seed: Record<string, string>;
  errors?: Record<string, string>;
}) {
  const [deposit, setDeposit] = useState(seed.deposit ?? "");
  const [balanceDueAt, setBalanceDueAt] = useState(seed.balanceDueAt ?? "");

  const depositCents = useMemo(() => {
    const s = String(deposit).trim();
    if (s === "") return null;
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }, [deposit]);

  // Balance-due timing is driven purely by the presence of a positive deposit;
  // event-level priceCents is derived from attendee types.
  const balanceDueActive = depositCents != null && depositCents > 0;

  return (
    <>
      <div>
        <AttendeeTypesField initialAttendeeTypes={null} />
        {errors?.price || errors?.priceCents ? (
          <p className="mt-2 text-sm text-destructive">
            {errors.price ?? errors.priceCents}
          </p>
        ) : null}
        {errors?.attendeeTypes && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {errors.attendeeTypes}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Input
            type="number"
            name="deposit"
            label="Zaliczka za osobę (PLN)"
            step="0.01"
            min="0"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            error={errors?.depositCents}
          />
          <p className="text-sm text-muted-foreground">
            Kwota płacona przy zapisie za każdego uczestnika zgłoszenia. Puste = pełna
            płatność od razu.
          </p>
        </div>
        <div className="space-y-1">
          <Input
            type="datetime-local"
            name="balanceDueAt"
            label="Termin dopłaty reszty"
            value={balanceDueActive ? balanceDueAt : ""}
            onChange={(e) => setBalanceDueAt(e.target.value)}
            disabled={!balanceDueActive}
            required={balanceDueActive}
            error={errors?.balanceDueAt}
          />
          <p className="text-sm text-muted-foreground">
            {balanceDueActive
              ? "Do kiedy uczestnik musi dopłacić pozostałą kwotę (przed startem wydarzenia)."
              : "Dostępne, gdy ustawisz zaliczkę — wtedy dopłata jest wymagana w podanym terminie."}
          </p>
        </div>
      </div>
      <Input
        type="number"
        name="capacity"
        label="Liczba miejsc"
        min="1"
        required
        defaultValue={seed.capacity}
        error={errors?.capacity}
      />
    </>
  );
}

export default function NewEventPage() {
  const [state, formAction] = useActionState<CreateEventFormState, FormData>(
    createEventAction,
    null,
  );
  const [slugPreview, setSlugPreview] = useState(state?.values?.slug ?? "");
  const v = state?.values ?? {};

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";

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
            defaultValue={v.title}
            error={state?.errors?.title}
          />
          <div>
            <Input
              name="slug"
              label="Nazwa w URL"
              required
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              minLength={3}
              maxLength={64}
              placeholder="np. warsztaty-kwietniowe"
              defaultValue={v.slug}
              error={state?.errors?.slug}
              onChange={(e) => setSlugPreview(e.target.value.toLowerCase())}
            />
            <p className="mt-1.5 rounded-lg bg-muted/60 px-3 py-1.5 font-mono text-xs text-muted-foreground">
              twoja-nazwa.{rootDomain}/<strong className="text-foreground">{slugPreview || "..."}</strong>
            </p>
          </div>
          <Textarea name="description" label="Opis" rows={4} defaultValue={v.description} error={state?.errors?.description} />
          <Input name="location" label="Miejsce" defaultValue={v.location} error={state?.errors?.location} />
          <EventDateTimeRange
            defaultStartsAt={v.startsAt ? new Date(v.startsAt).getTime() : undefined}
            defaultEndsAt={v.endsAt ? new Date(v.endsAt).getTime() : undefined}
            error={state?.errors?.startsAt ?? state?.errors?.endsAt}
          />
          <NewEventPricingFields
            key={JSON.stringify(state?.values ?? {})}
            seed={state?.values ?? {}}
            errors={state?.errors ?? undefined}
          />
          <ImageUpload
            name="coverUrl"
            label="Zdjęcie okładki (opcjonalnie)"
            aspect="cover"
            error={state?.errors?.coverUrl}
          />
          <div>
            <GalleryUpload name="galleryPhotos" max={5} />
          </div>

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

"use client";

import { useActionState } from "react";
import { createOrganizerAction } from "./actions";

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState<{ error?: string } | null, FormData>(
    async (_prev, formData) => {
      return (await createOrganizerAction(formData)) ?? null;
    },
    null,
  );

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold">Utwórz profil organizatora</h1>
      <p className="mt-2 text-muted-foreground">
        Twój profil będzie dostępny pod adresem{" "}
        <code>twoja-nazwa.wyjazdo.pl</code>.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Nazwa w URL (subdomena)</span>
          <input
            name="subdomain"
            required
            pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
            minLength={3}
            maxLength={32}
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="np. gorskie-wyjazdy"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Wyświetlana nazwa</span>
          <input
            name="displayName"
            required
            maxLength={100}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Krótki opis</span>
          <textarea
            name="description"
            maxLength={2000}
            rows={4}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Tworzenie..." : "Utwórz profil"}
        </button>
      </form>
    </div>
  );
}

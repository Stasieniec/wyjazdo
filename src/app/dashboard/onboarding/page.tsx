"use client";

import { useActionState } from "react";
import { createOrganizerAction } from "./actions";
import { Input, SubmitButton, Textarea } from "@/components/ui";

export default function OnboardingPage() {
  const [state, formAction] = useActionState<{ error?: string } | null, FormData>(
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
        <Input
          name="subdomain"
          label="Nazwa w URL (subdomena)"
          required
          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          minLength={3}
          maxLength={32}
          placeholder="np. gorskie-wyjazdy"
        />
        <Input name="displayName" label="Wyświetlana nazwa" required maxLength={100} />
        <Textarea name="description" label="Krótki opis" maxLength={2000} rows={4} />

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton pendingLabel="Tworzenie...">Utwórz profil</SubmitButton>
      </form>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createOrganizerAction } from "./actions";
import { Card, Input, SubmitButton, Textarea } from "@/components/ui";

export default function OnboardingPage() {
  const [subdomain, setSubdomain] = useState("");
  const [state, formAction] = useActionState<{ error?: string } | null, FormData>(
    async (_prev, formData) => {
      return (await createOrganizerAction(formData)) ?? null;
    },
    null,
  );

  const previewSlug = subdomain.trim() ? subdomain.trim().toLowerCase() : "twoja-nazwa";

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Witaj w Wyjazdo</h1>
      <p className="mt-2 text-muted-foreground">Stwórz swój profil organizatora, aby zacząć.</p>

      <Card className="mt-8">
        <form action={formAction} className="space-y-4">
          <div>
            <Input
              name="subdomain"
              label="Nazwa w URL (subdomena)"
              required
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              minLength={3}
              maxLength={32}
              placeholder="np. gorskie-wyjazdy"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Podgląd adresu:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground">
                {previewSlug}.wyjazdo.pl
              </code>
            </p>
          </div>
          <Input name="displayName" label="Wyświetlana nazwa" required maxLength={100} />
          <Textarea name="description" label="Krótki opis" maxLength={2000} rows={4} />

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <SubmitButton pendingLabel="Tworzenie...">Utwórz profil</SubmitButton>
        </form>
      </Card>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createOrganizerAction } from "./actions";
import { Card, Checkbox, Input, SubmitButton, Textarea } from "@/components/ui";

export default function OnboardingPage() {
  const [subdomain, setSubdomain] = useState("");
  const [state, formAction] = useActionState<{ error?: string; errors?: Record<string, string> } | null, FormData>(
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

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Dokumenty i zgody</p>
            <Checkbox
              name="acceptTerms"
              value="true"
              label={
                <>
                  Akceptuję{" "}
                  <a href="/regulamin" target="_blank" className="underline underline-offset-4 hover:text-primary">
                    Regulamin serwisu wyjazdo.pl
                  </a>{" "}
                  *
                </>
              }
              error={state?.errors?.acceptTerms}
            />
            <Checkbox
              name="acceptPrivacy"
              value="true"
              label={
                <>
                  Zapoznałem/am się z{" "}
                  <a href="/polityka-prywatnosci" target="_blank" className="underline underline-offset-4 hover:text-primary">
                    Polityką Prywatności
                  </a>{" "}
                  *
                </>
              }
              error={state?.errors?.acceptPrivacy}
            />
            <Checkbox
              name="acceptDpa"
              value="true"
              label={
                <>
                  Akceptuję{" "}
                  <a href="/regulamin#umowa-powierzenia" target="_blank" className="underline underline-offset-4 hover:text-primary">
                    Umowę powierzenia przetwarzania danych osobowych
                  </a>{" "}
                  (art. 28 RODO) *
                </>
              }
              error={state?.errors?.acceptDpa}
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <SubmitButton pendingLabel="Tworzenie...">Utwórz profil</SubmitButton>
        </form>
      </Card>
    </div>
  );
}

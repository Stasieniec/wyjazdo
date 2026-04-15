"use client";

import { useActionState } from "react";
import type { CustomQuestion } from "@/lib/validators/event";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/ui";
import { registerAction, type RegisterFormState } from "./actions";

type Props = {
  eventId: string;
  subdomain: string;
  eventSlug: string;
  isFull: boolean;
  questions: CustomQuestion[];
};

export function RegisterForm({ eventId, subdomain, eventSlug, isFull, questions }: Props) {
  const [state, formAction, pending] = useActionState<RegisterFormState, FormData>(
    registerAction,
    null,
  );

  return (
    <Card className="mt-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="organizerSubdomain" value={subdomain} />
        <input type="hidden" name="eventSlug" value={eventSlug} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Imię"
            name="firstName"
            required
            maxLength={100}
            error={state?.errors?.firstName}
          />
          <Input
            label="Nazwisko"
            name="lastName"
            required
            maxLength={100}
            error={state?.errors?.lastName}
          />
        </div>
        <Input
          type="email"
          label="Email"
          name="email"
          required
          error={state?.errors?.email}
        />
        <Input label="Telefon" name="phone" error={state?.errors?.phone} />

        {questions.map((q) => {
          const label = `${q.label}${q.required ? " *" : ""}`;
          const fieldError = state?.errors?.[`q_${q.id}`];
          if (q.type === "long_text") {
            return (
              <Textarea
                key={q.id}
                label={label}
                name={`q_${q.id}`}
                required={q.required}
                rows={3}
                error={fieldError}
              />
            );
          }
          if (q.type === "select") {
            return (
              <Select
                key={q.id}
                label={label}
                name={`q_${q.id}`}
                required={q.required}
                placeholder="—"
                options={q.options?.map((opt) => ({ value: opt, label: opt })) ?? []}
                error={fieldError}
              />
            );
          }
          return (
            <Input
              key={q.id}
              label={label}
              name={`q_${q.id}`}
              required={q.required}
              maxLength={500}
              error={fieldError}
            />
          );
        })}

        {state?.errors?._form && (
          <p className="text-sm text-destructive" role="alert">
            {state.errors._form}
          </p>
        )}

        <SubmitButton
          pendingLabel="Przetwarzanie..."
          variant="primary"
          className="text-white hover:opacity-90"
          style={{ backgroundColor: "var(--brand)" }}
        >
          {isFull ? "Dołącz do listy rezerwowej" : "Przejdź do płatności"}
        </SubmitButton>
      </form>
    </Card>
  );
}

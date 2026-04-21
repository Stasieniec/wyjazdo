"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/ui";
import { ConsentCheckboxes } from "@/components/sites/ConsentCheckboxes";
import { registerAction, type RegisterFormState } from "./actions";
import { AttendeeCard } from "./AttendeeCard";
import { PriceSummary } from "./price-summary";

type Props = {
  eventId: string;
  subdomain: string;
  eventSlug: string;
  isFull: boolean;
  questions: CustomQuestion[];
  consents: ConsentConfigItem[];
  attendeeTypes: AttendeeType[];
  remainingSpots: number;
  depositCents: number | null;
};

type AttendeeState = {
  attendeeTypeId: string;
  firstName: string;
  lastName: string;
  customAnswers: Record<string, string>;
};

function initialAttendees(types: AttendeeType[]): AttendeeState[] {
  const rows: AttendeeState[] = [];
  for (const t of types) {
    for (let i = 0; i < Math.max(1, t.minQty); i++) {
      rows.push({
        attendeeTypeId: t.id,
        firstName: "",
        lastName: "",
        customAnswers: {},
      });
    }
  }
  return rows;
}

export function RegisterForm({
  eventId,
  subdomain,
  eventSlug,
  isFull,
  questions,
  consents,
  attendeeTypes,
  remainingSpots,
  depositCents,
}: Props) {
  const [state, formAction, pending] = useActionState<RegisterFormState, FormData>(
    registerAction,
    null,
  );

  const [attendees, setAttendees] = useState<AttendeeState[]>(() =>
    initialAttendees(attendeeTypes),
  );
  const [registrantFirst, setRegistrantFirst] = useState("");
  const [registrantLast, setRegistrantLast] = useState("");

  useEffect(() => {
    setAttendees((prev) => {
      if (prev.length === 0) return prev;
      if (
        prev[0].firstName === registrantFirst &&
        prev[0].lastName === registrantLast
      )
        return prev;
      const next = [...prev];
      next[0] = {
        ...next[0],
        firstName: registrantFirst,
        lastName: registrantLast,
      };
      return next;
    });
  }, [registrantFirst, registrantLast]);

  const quantities = useMemo(() => {
    const q: Record<string, number> = {};
    for (const a of attendees)
      q[a.attendeeTypeId] = (q[a.attendeeTypeId] ?? 0) + 1;
    return q;
  }, [attendees]);

  const totalAttendees = attendees.length;
  const atCapacity = totalAttendees >= remainingSpots;

  function addAttendee(typeId: string) {
    setAttendees((prev) => [
      ...prev,
      { attendeeTypeId: typeId, firstName: "", lastName: "", customAnswers: {} },
    ]);
  }
  function removeAttendee(idx: number) {
    setAttendees((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateAttendee(
    idx: number,
    next: Omit<AttendeeState, "attendeeTypeId">,
  ) {
    setAttendees((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...next } : a)),
    );
  }

  const errors = state?.errors ?? {};
  const isSingleLegacy =
    attendeeTypes.length === 1 &&
    attendeeTypes[0].minQty === 1 &&
    attendeeTypes[0].maxQty === 1;

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
            value={registrantFirst}
            onChange={(e) => setRegistrantFirst(e.target.value)}
            error={state?.errors?.firstName}
          />
          <Input
            label="Nazwisko"
            name="lastName"
            required
            maxLength={100}
            value={registrantLast}
            onChange={(e) => setRegistrantLast(e.target.value)}
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

        {isSingleLegacy
          ? (attendeeTypes[0].customFields ?? []).length > 0 && (
              <AttendeeCard
                index={0}
                type={attendeeTypes[0]}
                label={attendeeTypes[0].name}
                canRemove={false}
                value={attendees[0]}
                onChange={(next) => updateAttendee(0, next)}
                errors={errors}
                hideNameFields={true}
              />
            )
          : (
              <>
                {attendees.map((a, i) => {
                  const type = attendeeTypes.find(
                    (t) => t.id === a.attendeeTypeId,
                  )!;
                  const sameTypeBefore = attendees
                    .slice(0, i)
                    .filter((x) => x.attendeeTypeId === a.attendeeTypeId).length;
                  const label =
                    i === 0 ? type.name : `${type.name} ${sameTypeBefore + 1}`;
                  const qtyOfType = quantities[a.attendeeTypeId] ?? 0;
                  return (
                    <AttendeeCard
                      key={i}
                      index={i}
                      type={type}
                      label={label}
                      canRemove={i > 0 && qtyOfType > type.minQty}
                      onRemove={() => removeAttendee(i)}
                      value={a}
                      onChange={(next) => updateAttendee(i, next)}
                      errors={errors}
                      hideNameFields={i === 0}
                    />
                  );
                })}

                <div className="flex flex-wrap gap-2">
                  {attendeeTypes.map((t) => {
                    const qty = quantities[t.id] ?? 0;
                    if (qty >= t.maxQty) return null;
                    if (atCapacity) return null;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => addAttendee(t.id)}
                        className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                      >
                        + Dodaj {t.name.toLowerCase()}
                      </button>
                    );
                  })}
                  {atCapacity && (
                    <span className="text-sm text-gray-600">
                      Pozostało {remainingSpots} wolnych miejsc.
                    </span>
                  )}
                </div>

                <PriceSummary
                  types={attendeeTypes}
                  quantities={quantities}
                  depositPerPersonCents={depositCents}
                />
              </>
            )}

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

        <ConsentCheckboxes eventConsents={consents} errors={state?.errors} />

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

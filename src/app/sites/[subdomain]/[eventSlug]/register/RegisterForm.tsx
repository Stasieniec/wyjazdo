"use client";

import { useActionState, useMemo, useState } from "react";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/ui";
import { ConsentCheckboxes } from "@/components/sites/ConsentCheckboxes";
import { pluralOsoby, pluralWolneMiejsca } from "@/lib/plural";
import { registerAction, type RegisterFormState } from "./actions";
import { AttendeeCard } from "./AttendeeCard";
import { PriceSummary } from "./price-summary";

type Props = {
  eventId: string;
  subdomain: string;
  eventSlug: string;
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
  questions,
  consents,
  attendeeTypes,
  remainingSpots,
  depositCents,
}: Props) {
  const [state, formAction] = useActionState<RegisterFormState, FormData>(
    registerAction,
    null,
  );

  const [attendees, setAttendees] = useState<AttendeeState[]>(() =>
    initialAttendees(attendeeTypes),
  );
  const [registrantFirst, setRegistrantFirst] = useState("");
  const [registrantLast, setRegistrantLast] = useState("");
  // React 19 resets uncontrolled inputs after a form action returns, even on
  // validation errors. Hold these client-side so the user doesn't lose them
  // when the server returns errors.
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consentValues, setConsentValues] = useState<Record<string, boolean>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  // The first attendee row is always the registrant; their name lives in
  // `registrantFirst`/`registrantLast` (separate inputs above the form), not
  // in `attendees[0].firstName`. Overlay them at render time so the hidden
  // form inputs in AttendeeCard pick up the right value at submit.
  const renderedAttendees = useMemo<AttendeeState[]>(() => {
    if (attendees.length === 0) return attendees;
    const first = attendees[0];
    if (first.firstName === registrantFirst && first.lastName === registrantLast) {
      return attendees;
    }
    const next = attendees.slice();
    next[0] = { ...first, firstName: registrantFirst, lastName: registrantLast };
    return next;
  }, [attendees, registrantFirst, registrantLast]);

  const quantities = useMemo(() => {
    const q: Record<string, number> = {};
    for (const a of attendees)
      q[a.attendeeTypeId] = (q[a.attendeeTypeId] ?? 0) + 1;
    return q;
  }, [attendees]);

  const totalAttendees = renderedAttendees.length;
  const willBeWaitlisted = remainingSpots === 0 || totalAttendees > remainingSpots;

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={state?.errors?.email}
        />
        <Input
          label="Telefon"
          name="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={state?.errors?.phone}
        />

        {isSingleLegacy
          ? (attendeeTypes[0].customFields ?? []).length > 0 ? (
              <AttendeeCard
                index={0}
                type={attendeeTypes[0]}
                label={attendeeTypes[0].name}
                canRemove={false}
                value={renderedAttendees[0]}
                onChange={(next) => updateAttendee(0, next)}
                errors={errors}
                hideNameFields={true}
              />
            ) : (
              <>
                <input type="hidden" name="attendees[0][attendeeTypeId]" value={attendeeTypes[0].id} />
                <input type="hidden" name="attendees[0][firstName]" value={renderedAttendees[0]?.firstName ?? ""} />
                <input type="hidden" name="attendees[0][lastName]" value={renderedAttendees[0]?.lastName ?? ""} />
              </>
            )
          : (
              <>
                {renderedAttendees.map((a, i) => {
                  const type = attendeeTypes.find(
                    (t) => t.id === a.attendeeTypeId,
                  )!;
                  const sameTypeBefore = renderedAttendees
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
                </div>

                {willBeWaitlisted && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Lista rezerwowa.</strong>{" "}
                    {remainingSpots === 0
                      ? `To wydarzenie jest w pełni zajęte, a zapisujesz ${totalAttendees} ${pluralOsoby(totalAttendees)}.`
                      : `To wydarzenie ma tylko ${remainingSpots} ${pluralWolneMiejsca(remainingSpots)}, a zapisujesz ${totalAttendees} ${pluralOsoby(totalAttendees)}.`}{" "}
                    Wszystkie osoby trafią na listę rezerwową — organizator przeniesie Was na listę główną, jeśli zwolnią się miejsca.
                  </div>
                )}

                <PriceSummary
                  types={attendeeTypes}
                  quantities={quantities}
                  depositPerPersonCents={depositCents}
                />
              </>
            )}

        {questions.map((q) => {
          const label = q.label;
          const name = `q_${q.id}`;
          const fieldError = state?.errors?.[name];
          const value = questionAnswers[q.id] ?? "";
          const setValue = (v: string) =>
            setQuestionAnswers((prev) => ({ ...prev, [q.id]: v }));
          if (q.type === "long_text") {
            return (
              <Textarea
                key={q.id}
                label={label}
                name={name}
                required={q.required}
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                error={fieldError}
              />
            );
          }
          if (q.type === "select") {
            return (
              <Select
                key={q.id}
                label={label}
                name={name}
                required={q.required}
                placeholder="—"
                options={q.options?.map((opt) => ({ value: opt, label: opt })) ?? []}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                error={fieldError}
              />
            );
          }
          return (
            <Input
              key={q.id}
              label={label}
              name={name}
              required={q.required}
              maxLength={500}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={fieldError}
            />
          );
        })}

        <ConsentCheckboxes
          eventConsents={consents}
          errors={state?.errors}
          values={consentValues}
          onChange={(name, checked) =>
            setConsentValues((prev) => ({ ...prev, [name]: checked }))
          }
        />

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
          {willBeWaitlisted ? "Dołącz do listy rezerwowej" : "Przejdź do płatności"}
        </SubmitButton>
      </form>
    </Card>
  );
}

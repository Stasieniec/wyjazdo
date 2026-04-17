"use client";
import type { AttendeeType } from "@/lib/validators/attendee-types";

type Props = {
  index: number; // position in form (attendees[N])
  type: AttendeeType;
  label: string; // "Dziecko 1"
  canRemove: boolean;
  onRemove?: () => void;
  value: { firstName: string; lastName: string; customAnswers: Record<string, string> };
  onChange: (next: { firstName: string; lastName: string; customAnswers: Record<string, string> }) => void;
  errors: Record<string, string>;
  hideNameFields?: boolean;
};

export function AttendeeCard({ index, type, label, canRemove, onRemove, value, onChange, errors, hideNameFields = false }: Props) {
  function setField<K extends "firstName" | "lastName">(k: K, v: string) {
    onChange({ ...value, [k]: v });
  }
  function setCustom(id: string, v: string) {
    onChange({ ...value, customAnswers: { ...value.customAnswers, [id]: v } });
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{label}</div>
        {canRemove && (
          <button type="button" className="text-sm text-red-600 underline" onClick={onRemove}>
            Usuń
          </button>
        )}
      </div>

      {/* Hidden type id for form POST */}
      <input type="hidden" name={`attendees[${index}][attendeeTypeId]`} value={type.id} />

      {hideNameFields ? (
        <>
          <input type="hidden" name={`attendees[${index}][firstName]`} value={value.firstName} />
          <input type="hidden" name={`attendees[${index}][lastName]`} value={value.lastName} />
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm flex flex-col">
            Imię
            <input
              name={`attendees[${index}][firstName]`}
              value={value.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              className="border rounded px-2 py-1"
              required
            />
            {errors[`attendees[${index}][firstName]`] && (
              <span className="text-red-600 text-xs">{errors[`attendees[${index}][firstName]`]}</span>
            )}
          </label>
          <label className="text-sm flex flex-col">
            Nazwisko
            <input
              name={`attendees[${index}][lastName]`}
              value={value.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              className="border rounded px-2 py-1"
              required
            />
            {errors[`attendees[${index}][lastName]`] && (
              <span className="text-red-600 text-xs">{errors[`attendees[${index}][lastName]`]}</span>
            )}
          </label>
        </div>
      )}

      {(type.customFields ?? []).map((f) => (
        <label key={f.id} className="text-sm flex flex-col">
          {f.label} {f.required && <span className="text-red-600">*</span>}
          {f.type === "long_text" ? (
            <textarea
              name={`attendees[${index}][field_${f.id}]`}
              value={value.customAnswers[f.id] ?? ""}
              onChange={(e) => setCustom(f.id, e.target.value)}
              className="border rounded px-2 py-1"
              required={f.required}
            />
          ) : f.type === "select" ? (
            <select
              name={`attendees[${index}][field_${f.id}]`}
              value={value.customAnswers[f.id] ?? ""}
              onChange={(e) => setCustom(f.id, e.target.value)}
              className="border rounded px-2 py-1"
              required={f.required}
            >
              <option value="">—</option>
              {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              name={`attendees[${index}][field_${f.id}]`}
              value={value.customAnswers[f.id] ?? ""}
              onChange={(e) => setCustom(f.id, e.target.value)}
              className="border rounded px-2 py-1"
              required={f.required}
            />
          )}
          {errors[`attendees[${index}][field_${f.id}]`] && (
            <span className="text-red-600 text-xs">{errors[`attendees[${index}][field_${f.id}]`]}</span>
          )}
        </label>
      ))}
    </div>
  );
}

"use client";
import type { AttendeeType } from "@/lib/validators/attendee-types";

type CustomFields = NonNullable<AttendeeType["customFields"]>;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

type Props = {
  value: CustomFields;
  onChange: (next: CustomFields | undefined) => void;
  /** Optional heading override; defaults to "Dodatkowe pola". */
  heading?: string;
  /** Optional description shown below the heading. Pass `null` to suppress. */
  description?: string | null;
};

const DEFAULT_DESCRIPTION =
  "Pola do wypełnienia przez uczestnika w formularzu zapisu — po jednym zestawie dla każdej osoby tego typu. Dobre do pytań typu wiek, rozmiar koszulki, alergie czy dieta.";

export function AttendeeCustomFieldsEditor({ value, onChange, heading = "Dodatkowe pola", description }: Props) {
  const fields = value ?? [];
  const desc = description === null ? null : (description ?? DEFAULT_DESCRIPTION);
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{heading}</div>
      {desc && <p className="text-sm text-gray-600">{desc}</p>}
      {fields.map((f, i) => (
        <div key={f.id} className="flex gap-2 items-center flex-wrap">
          <input placeholder="Nazwa pola (np. Wiek)" value={f.label}
            onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
            className="border rounded px-2 py-1" />
          <select value={f.type}
            onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, type: e.target.value as typeof f.type } : x))}
            className="border rounded px-2 py-1 text-sm">
            <option value="text">tekst</option>
            <option value="long_text">długi tekst</option>
            <option value="number">liczba</option>
            <option value="date">data</option>
            <option value="select">lista wyboru</option>
          </select>
          <label className="text-sm flex items-center gap-1.5">
            <input type="checkbox" checked={f.required}
              onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} />
            wymagane
          </label>
          <button type="button" className="text-sm text-red-600 underline" onClick={() => onChange(fields.filter((_, j) => j !== i))}>Usuń pole</button>
        </div>
      ))}
      <button type="button" className="text-sm border rounded px-3 py-1"
        onClick={() => onChange([...fields, { id: uid(), label: "Nowe pole", type: "text", required: false }])}>
        + Dodaj pole
      </button>
    </div>
  );
}

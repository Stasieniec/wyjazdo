"use client";
import type { AttendeeCustomField, AttendeeType } from "@/lib/validators/attendee-types";

type CustomFields = NonNullable<AttendeeType["customFields"]>;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultSelectOptions(): string[] {
  return ["", ""];
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

  function patchField(i: number, patch: Partial<AttendeeCustomField>) {
    onChange(fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{heading}</div>
      {desc && <p className="text-sm text-gray-600">{desc}</p>}
      {fields.map((f, i) => (
        <div key={f.id} className="space-y-2 rounded-md border border-border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              placeholder="Nazwa pola (np. Wiek)"
              value={f.label}
              onChange={(e) => patchField(i, { label: e.target.value })}
              className="border rounded px-2 py-1"
            />
            <select
              value={f.type}
              onChange={(e) => {
                const t = e.target.value as AttendeeCustomField["type"];
                if (t === "select") {
                  patchField(i, {
                    type: "select",
                    options: f.type === "select" && f.options?.length ? f.options : defaultSelectOptions(),
                  });
                } else {
                  patchField(i, { type: t, options: undefined });
                }
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="text">Krótki tekst</option>
              <option value="long_text">Długi tekst</option>
              <option value="number">Liczba</option>
              <option value="date">Data</option>
              <option value="select">Lista wyboru</option>
            </select>
            <label className="text-sm flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => patchField(i, { required: e.target.checked })}
              />
              wymagane
            </label>
            <button
              type="button"
              className="text-sm text-red-600 underline"
              onClick={() => onChange(fields.filter((_, j) => j !== i))}
            >
              Usuń pole
            </button>
          </div>
          {f.type === "select" && (
            <SelectOptionsList
              options={f.options ?? defaultSelectOptions()}
              onChange={(next) => patchField(i, { options: next })}
            />
          )}
        </div>
      ))}
      <button
        type="button"
        className="text-sm border rounded px-3 py-1"
        onClick={() => onChange([...fields, { id: uid(), label: "Nowe pole", type: "text", required: false }])}
      >
        + Dodaj pole
      </button>
    </div>
  );
}

function SelectOptionsList({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  function update(i: number, value: string) {
    const next = [...options];
    next[i] = value;
    onChange(next);
  }
  function remove(i: number) {
    if (options.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(options.filter((_, j) => j !== i));
  }
  function add() {
    onChange([...options, ""]);
  }

  return (
    <div className="rounded-md border border-border/80 bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Opcje odpowiedzi</p>
      <ul className="space-y-2">
        {options.map((value, j) => (
          <li key={j} className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => update(j, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder={`Opcja ${j + 1}`}
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              aria-label={`Tekst opcji ${j + 1}`}
            />
            <button
              type="button"
              onClick={() => remove(j)}
              className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={`Usuń opcję ${j + 1}`}
              title="Usuń opcję"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/5"
      >
        <span className="text-lg leading-none" aria-hidden>+</span>
        Dodaj opcję
      </button>
    </div>
  );
}

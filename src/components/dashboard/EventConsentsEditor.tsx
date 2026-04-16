"use client";

import { useState } from "react";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import { newId } from "@/lib/ids";

type Props = {
  initial: ConsentConfigItem[];
  name: string;
};

const PRESET_CONSENTS: Array<{
  label: string;
  description: string;
  category: ConsentConfigItem["category"];
}> = [
  {
    label: "Zgoda na wykorzystanie wizerunku",
    description:
      "Wyrażam zgodę na utrwalanie i wykorzystanie mojego wizerunku (zdjęcia, filmy) w celach promocyjnych organizatora, zgodnie z art. 81 ustawy o prawie autorskim.",
    category: "photo",
  },
  {
    label: "Zgoda na przetwarzanie danych dot. zdrowia",
    description:
      "Wyrażam zgodę na przetwarzanie podanych przeze mnie danych dotyczących zdrowia w celu zapewnienia bezpieczeństwa podczas wydarzenia (art. 9 ust. 2 lit. a RODO).",
    category: "health",
  },
  {
    label: "Zgoda na komunikację marketingową organizatora",
    description:
      "Wyrażam zgodę na otrzymywanie informacji marketingowych od organizatora drogą elektroniczną.",
    category: "marketing",
  },
];

export default function EventConsentsEditor({ initial, name }: Props) {
  const [consents, setConsents] = useState<ConsentConfigItem[]>(initial);

  function update(i: number, patch: Partial<ConsentConfigItem>) {
    setConsents((c) => c.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function remove(i: number) {
    setConsents((c) => c.filter((_, idx) => idx !== i));
  }
  function addPreset(preset: (typeof PRESET_CONSENTS)[number]) {
    setConsents((c) => [
      ...c,
      {
        id: newId(),
        label: preset.label,
        description: preset.description,
        required: false,
        category: preset.category,
      },
    ]);
  }
  function addCustom() {
    setConsents((c) => [
      ...c,
      { id: newId(), label: "", description: "", required: false, category: "custom" as const },
    ]);
  }

  const usedCategories = new Set(consents.map((c) => c.category));

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(consents)} />

      {/* Read-only: platform consents */}
      <div className="mb-4 rounded-md border border-border/80 bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Zgody wymagane przez platformę (zawsze widoczne, nie można usunąć)
        </p>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          <li className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded border border-primary bg-primary/10" />
            Akceptacja Regulaminu serwisu wyjazdo.pl
            <span className="ml-auto text-xs text-muted-foreground">wymagane</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded border border-primary bg-primary/10" />
            Zapoznanie się z Polityką Prywatności
            <span className="ml-auto text-xs text-muted-foreground">wymagane</span>
          </li>
        </ul>
      </div>

      {/* Organizer-configured consents */}
      {consents.length > 0 && (
        <ul className="space-y-3">
          {consents.map((c, i) => (
            <li key={c.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap gap-2">
                <input
                  placeholder="Treść zgody"
                  value={c.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  className="min-w-[12rem] flex-1 rounded border px-2 py-1 text-sm"
                />
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={c.required}
                    onChange={(e) => update(i, { required: e.target.checked })}
                  />
                  wymagana
                </label>
                <button type="button" onClick={() => remove(i)} className="text-sm text-red-600">
                  Usuń
                </button>
              </div>
              {(c.category === "custom" || c.description) && (
                <textarea
                  placeholder="Opis / pełna treść zgody (opcjonalnie)"
                  value={c.description ?? ""}
                  onChange={(e) => update(i, { description: e.target.value })}
                  className="mt-2 w-full rounded border px-2 py-1 text-sm"
                  rows={2}
                />
              )}
              {c.category !== "custom" && (
                <span className="mt-2 inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {c.category === "photo" && "wizerunek"}
                  {c.category === "health" && "dane zdrowotne"}
                  {c.category === "marketing" && "marketing"}
                  {c.category === "general" && "ogólna"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESET_CONSENTS.filter((p) => !usedCategories.has(p.category)).map((preset) => (
          <button
            key={preset.category}
            type="button"
            onClick={() => addPreset(preset)}
            className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
          >
            + {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={addCustom}
          className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          + Własna zgoda
        </button>
      </div>
    </div>
  );
}

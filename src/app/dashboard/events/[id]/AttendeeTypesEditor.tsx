"use client";
import { useState } from "react";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { ZlotyInput } from "@/components/ui";
import { AttendeeCustomFieldsEditor } from "./AttendeeCustomFieldsEditor";

type Props = {
  value: AttendeeType[];
  onChange: (next: AttendeeType[]) => void;
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function AttendeeTypesEditor({ value, onChange }: Props) {
  const [open, setOpen] = useState<number | null>(0);

  function update(idx: number, patch: Partial<AttendeeType>) {
    onChange(value.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function removeType(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function addType() {
    onChange([
      ...value,
      { id: uid(), name: "Nowy typ", minQty: 1, maxQty: 1, priceCents: 0 },
    ]);
  }

  return (
    <div className="space-y-3">
      {value.map((t, idx) => (
        <div key={t.id} className="border rounded-md">
          <button
            type="button"
            className="w-full flex justify-between px-3 py-2"
            onClick={() => setOpen(open === idx ? null : idx)}
          >
            <span>{t.name} ({t.minQty}–{t.maxQty}, {(t.priceCents / 100).toFixed(2)} zł)</span>
            <span>{open === idx ? "▾" : "▸"}</span>
          </button>
          {open === idx && (
            <div className="p-3 border-t space-y-3">
              <label className="text-sm flex flex-col">Nazwa
                <input value={t.name} onChange={(e) => update(idx, { name: e.target.value })} className="border rounded px-2 py-1" />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-sm flex flex-col">
                  <span>Min. osób</span>
                  <input type="number" min={0} value={t.minQty} onChange={(e) => update(idx, { minQty: Number(e.target.value) })} className="border rounded px-2 py-1" />
                </label>
                <label className="text-sm flex flex-col">
                  <span>Maks. osób</span>
                  <input type="number" min={1} value={t.maxQty} onChange={(e) => update(idx, { maxQty: Number(e.target.value) })} className="border rounded px-2 py-1" />
                </label>
                <label className="text-sm flex flex-col">
                  <span>Cena (PLN)</span>
                  <ZlotyInput valueCents={t.priceCents} onChangeCents={(c) => update(idx, { priceCents: c })} className="border rounded px-2 py-1" />
                </label>
              </div>
              <p className="text-sm text-gray-600">
                Ile osób tego typu uczestnik może zapisać w jednym zgłoszeniu (np. 1–5 dzieci).
              </p>

              <GraduatedPricingEditor type={t} onChange={(gp) => update(idx, { graduatedPricing: gp })} />
              <AttendeeCustomFieldsEditor
                value={t.customFields ?? []}
                onChange={(cf) => update(idx, { customFields: cf })}
              />

              <button type="button" className="text-sm text-red-600 underline" onClick={() => removeType(idx)}>
                Usuń typ
              </button>
            </div>
          )}
        </div>
      ))}
      <button type="button" className="text-sm border rounded px-3 py-1" onClick={addType}>
        + Dodaj typ uczestnika
      </button>
    </div>
  );
}

function GraduatedPricingEditor({ type, onChange }: { type: AttendeeType; onChange: (t: AttendeeType["graduatedPricing"]) => void }) {
  const tiers = type.graduatedPricing ?? [];
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Zniżki dla kolejnych uczestników</div>
      <p className="text-sm text-gray-600">
        Niższa cena od drugiej (lub kolejnej) osoby tego typu — na przykład taniej za drugie i każde następne dziecko w jednym zgłoszeniu.
      </p>
      {tiers.map((tier, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-center">
          <span className="text-sm">od</span>
          <input type="number" min={2} value={tier.fromQty}
            onChange={(e) => onChange(tiers.map((t, j) => j === i ? { ...t, fromQty: Number(e.target.value) } : t))}
            className="border rounded px-2 py-1 w-20" />
          <span className="text-sm">-ej osoby, cena (PLN)</span>
          <ZlotyInput valueCents={tier.priceCents}
            onChangeCents={(c) => onChange(tiers.map((t, j) => j === i ? { ...t, priceCents: c } : t))}
            className="border rounded px-2 py-1 w-28" />
          <button type="button" className="text-sm text-red-600 underline" onClick={() => onChange(tiers.filter((_, j) => j !== i))}>Usuń próg</button>
        </div>
      ))}
      <button type="button" className="text-sm border rounded px-3 py-1" onClick={() => onChange([...tiers, { fromQty: 2, priceCents: 0 }])}>
        + Dodaj próg zniżki
      </button>
    </div>
  );
}


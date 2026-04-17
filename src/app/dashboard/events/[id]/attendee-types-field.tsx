"use client";
import { useState } from "react";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { PRESET_IDS, PRESET_LABELS, buildPresetTypes, type PresetId } from "@/lib/attendee-presets";
import { AttendeeTypesEditor } from "./AttendeeTypesEditor";

type Props = {
  initialAttendeeTypes: AttendeeType[] | null;
  basePriceCents: number;
  name?: string; // hidden input name, defaults to "attendeeTypes"
};

function detectPreset(types: AttendeeType[] | null): PresetId | "custom" {
  if (!types || types.length === 0) return "jedna_osoba";
  if (types.length === 1 && types[0].maxQty === 1) return "jedna_osoba";
  if (types.length === 1 && types[0].maxQty > 1) return "grupa";
  if (
    types.length === 2 &&
    types.some((t) => t.name.toLowerCase() === "rodzic") &&
    types.some((t) => t.name.toLowerCase() === "dziecko")
  ) {
    return "rodzic_z_dziecmi";
  }
  return "custom";
}

export function AttendeeTypesField({ initialAttendeeTypes, basePriceCents, name = "attendeeTypes" }: Props) {
  const [preset, setPreset] = useState<PresetId | "custom">(() => detectPreset(initialAttendeeTypes));
  const [types, setTypes] = useState<AttendeeType[]>(() => {
    if (initialAttendeeTypes && initialAttendeeTypes.length > 0) return initialAttendeeTypes;
    return buildPresetTypes("jedna_osoba", { basePriceCents });
  });

  function applyPreset(p: PresetId | "custom") {
    setPreset(p);
    if (p === "custom") return; // keep current
    setTypes(buildPresetTypes(p, { basePriceCents }));
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold">Kto bierze udział?</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {PRESET_IDS.map((p) => {
          const meta = PRESET_LABELS[p];
          const active = preset === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={`border rounded-md p-3 text-left ${active ? "border-black bg-gray-50" : "border-gray-300"}`}
            >
              <div className="font-semibold text-sm">{meta.title}</div>
              <div className="text-xs text-gray-600">{meta.description}</div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="text-xs underline text-gray-600"
        onClick={() => setPreset("custom")}
      >
        {preset === "custom" ? "Używasz własnej konfiguracji" : "Potrzebujesz innej konfiguracji? Utwórz własną →"}
      </button>

      {preset === "rodzic_z_dziecmi" && (
        <RodzicPresetFields types={types} onChange={setTypes} />
      )}
      {preset === "grupa" && (
        <GrupaPresetFields types={types} onChange={setTypes} />
      )}
      {preset === "jedna_osoba" && (
        <JednaOsobaPresetFields types={types} onChange={setTypes} />
      )}
      {preset === "custom" && (
        <AttendeeTypesEditor value={types} onChange={setTypes} />
      )}

      <input type="hidden" name={name} value={JSON.stringify(types)} />
    </div>
  );
}

function JednaOsobaPresetFields({ types, onChange }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void }) {
  const t = types[0];
  return (
    <label className="text-sm flex flex-col max-w-xs">
      Cena (gr)
      <input
        type="number"
        min={0}
        value={t.priceCents}
        onChange={(e) => onChange([{ ...t, priceCents: Number(e.target.value) }])}
        className="border rounded px-2 py-1"
      />
    </label>
  );
}

function GrupaPresetFields({ types, onChange }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void }) {
  const t = types[0];
  return (
    <div className="space-y-2">
      <label className="text-sm flex flex-col max-w-xs">
        Cena za uczestnika (gr)
        <input type="number" min={0} value={t.priceCents}
          onChange={(e) => onChange([{ ...t, priceCents: Number(e.target.value) }])}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex flex-col max-w-xs">
        Maksymalna liczba uczestników
        <input type="number" min={1} max={50} value={t.maxQty}
          onChange={(e) => onChange([{ ...t, maxQty: Number(e.target.value) }])}
          className="border rounded px-2 py-1" />
      </label>
    </div>
  );
}

function RodzicPresetFields({ types, onChange }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void }) {
  const parent = types.find((t) => t.name.toLowerCase() === "rodzic") ?? types[0];
  const child = types.find((t) => t.name.toLowerCase() === "dziecko") ?? types[1];
  const discount = child.graduatedPricing?.[0];

  function setParentPrice(v: number) {
    onChange(types.map((t) => (t.id === parent.id ? { ...t, priceCents: v } : t)));
  }
  function setChildPrice(v: number) {
    onChange(types.map((t) => (t.id === child.id ? { ...t, priceCents: v } : t)));
  }
  function setChildMax(v: number) {
    onChange(types.map((t) => (t.id === child.id ? { ...t, maxQty: v } : t)));
  }
  function toggleDiscount(on: boolean) {
    onChange(types.map((t) => {
      if (t.id !== child.id) return t;
      return { ...t, graduatedPricing: on ? [{ fromQty: 2, priceCents: 0 }] : undefined };
    }));
  }
  function setDiscountFrom(v: number) {
    onChange(types.map((t) => {
      if (t.id !== child.id) return t;
      const tier = (t.graduatedPricing ?? [{ fromQty: 2, priceCents: 0 }])[0];
      return { ...t, graduatedPricing: [{ ...tier, fromQty: v }] };
    }));
  }
  function setDiscountPrice(v: number) {
    onChange(types.map((t) => {
      if (t.id !== child.id) return t;
      const tier = (t.graduatedPricing ?? [{ fromQty: 2, priceCents: 0 }])[0];
      return { ...t, graduatedPricing: [{ ...tier, priceCents: v }] };
    }));
  }

  return (
    <div className="space-y-3">
      <label className="text-sm flex flex-col max-w-xs">
        Cena Rodzica (gr)
        <input type="number" min={0} value={parent.priceCents}
          onChange={(e) => setParentPrice(Number(e.target.value))}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex flex-col max-w-xs">
        Cena za Dziecko (gr)
        <input type="number" min={0} value={child.priceCents}
          onChange={(e) => setChildPrice(Number(e.target.value))}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex flex-col max-w-xs">
        Maksymalna liczba dzieci
        <input type="number" min={1} max={10} value={child.maxQty}
          onChange={(e) => setChildMax(Number(e.target.value))}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={!!discount} onChange={(e) => toggleDiscount(e.target.checked)} />
        Zniżka dla kolejnych dzieci
      </label>
      {discount && (
        <div className="flex gap-2 items-center">
          <span className="text-sm">od</span>
          <input type="number" min={2} value={discount.fromQty}
            onChange={(e) => setDiscountFrom(Number(e.target.value))}
            className="border rounded px-2 py-1 w-20" />
          <span className="text-sm">-go dziecka, cena (gr)</span>
          <input type="number" min={0} value={discount.priceCents}
            onChange={(e) => setDiscountPrice(Number(e.target.value))}
            className="border rounded px-2 py-1 w-28" />
        </div>
      )}
    </div>
  );
}

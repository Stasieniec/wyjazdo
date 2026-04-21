"use client";
import { useMemo, useState } from "react";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { PRESET_IDS, PRESET_LABELS, buildPresetTypes, type PresetId } from "@/lib/attendee-presets";
import { calculateTotal } from "@/lib/pricing";
import { ZlotyInput } from "@/components/ui";
import { AttendeeTypesEditor } from "./AttendeeTypesEditor";
import { AttendeeCustomFieldsEditor } from "./AttendeeCustomFieldsEditor";

type Props = {
  initialAttendeeTypes: AttendeeType[] | null;
  /** Hidden input name for the serialized attendee types JSON. Defaults to "attendeeTypes". */
  name?: string;
  /**
   * Hidden input name for the derived event.priceCents value (in PLN, same convention as the
   * existing "price" field). Defaults to "price".
   * The derived value is the minimum total for this event (sum of minQty × price across all types),
   * serving as a "starting from" figure for listings.
   */
  priceHiddenName?: string;
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

function derivedPriceCents(types: AttendeeType[]): number {
  const quantities: Record<string, number> = {};
  for (const t of types) quantities[t.id] = Math.max(1, t.minQty);
  return calculateTotal(types, quantities).total;
}

function hasUserData(types: AttendeeType[]): boolean {
  return types.some(
    (t) =>
      t.priceCents > 0 ||
      (t.customFields?.length ?? 0) > 0 ||
      (t.graduatedPricing?.length ?? 0) > 0,
  );
}

function centsToPLNString(cents: number): string {
  if (cents === 0) return "0";
  return (cents / 100).toString().replace(".", ",");
}

export function AttendeeTypesField({ initialAttendeeTypes, name = "attendeeTypes", priceHiddenName = "price" }: Props) {
  const [preset, setPreset] = useState<PresetId | "custom">(() => detectPreset(initialAttendeeTypes));
  const [types, setTypes] = useState<AttendeeType[]>(() => {
    if (initialAttendeeTypes && initialAttendeeTypes.length > 0) return initialAttendeeTypes;
    return buildPresetTypes("jedna_osoba", { basePriceCents: 0 });
  });

  function applyPreset(p: PresetId | "custom") {
    if (p === preset) return;
    if (p !== "custom" && hasUserData(types)) {
      const ok = window.confirm(
        "Zmienić szablon? Stracisz ustawione ceny i pytania.",
      );
      if (!ok) return;
    }
    setPreset(p);
    if (p === "custom") return;
    setTypes(buildPresetTypes(p, { basePriceCents: 0 }));
  }

  const derivedPrice = useMemo(() => derivedPriceCents(types), [types]);

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
              <div className="text-sm text-gray-600">{meta.description}</div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setPreset("custom")}
        className={`w-full border border-dashed rounded-md p-3 text-left ${preset === "custom" ? "border-black bg-gray-50" : "border-gray-400 hover:bg-gray-50"}`}
      >
        <div className="font-semibold text-sm">
          {preset === "custom" ? "Własna konfiguracja" : "Potrzebujesz innej konfiguracji?"}
        </div>
        <div className="text-sm text-gray-600">
          {preset === "custom"
            ? "Edytujesz typy uczestników ręcznie."
            : "Utwórz własne typy uczestników (np. dorosły + senior, kilku typów uczestników z różnymi cenami)."}
        </div>
      </button>

      {preset === "jedna_osoba" && <JednaOsobaPresetFields types={types} onChange={setTypes} />}
      {preset === "rodzic_z_dziecmi" && <RodzicPresetFields types={types} onChange={setTypes} />}
      {preset === "grupa" && <GrupaPresetFields types={types} onChange={setTypes} />}
      {preset === "custom" && (
        <>
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Zaawansowana konfiguracja.</strong> Jeśli nie jesteś pewna, wybierz jeden z szablonów powyżej — pokryją większość sytuacji.
          </div>
          <AttendeeTypesEditor value={types} onChange={setTypes} />
        </>
      )}

      <input type="hidden" name={name} value={JSON.stringify(types)} />
      <input type="hidden" name={priceHiddenName} value={centsToPLNString(derivedPrice)} />
    </div>
  );
}

function JednaOsobaPresetFields({ types, onChange }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void }) {
  const t = types[0];
  return (
    <div className="space-y-4">
      <label className="text-sm flex flex-col max-w-xs">
        Cena (PLN)
        <ZlotyInput valueCents={t.priceCents}
          onChangeCents={(c) => onChange([{ ...t, priceCents: c }])}
          className="border rounded px-2 py-1" />
      </label>
      <AttendeeCustomFieldsEditor
        heading="Pytania o uczestnika"
        description="Dodatkowe pytania w formularzu zapisu — np. rozmiar koszulki, alergie, dieta."
        value={t.customFields ?? []}
        onChange={(cf) => onChange([{ ...t, customFields: cf }])}
      />
    </div>
  );
}

function GrupaPresetFields({ types, onChange }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void }) {
  const t = types[0];
  return (
    <div className="space-y-4">
      <label className="text-sm flex flex-col max-w-xs">
        Cena za uczestnika (PLN)
        <ZlotyInput valueCents={t.priceCents}
          onChangeCents={(c) => onChange([{ ...t, priceCents: c }])}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex flex-col max-w-xs">
        Maksymalna liczba uczestników
        <input type="number" min={1} max={50} value={t.maxQty}
          onChange={(e) => onChange([{ ...t, maxQty: Number(e.target.value) }])}
          className="border rounded px-2 py-1" />
      </label>
      <AttendeeCustomFieldsEditor
        heading="Pytania o każdego uczestnika"
        description="Pojawią się w formularzu zapisu dla każdej osoby w grupie — np. stanowisko, dieta, alergie."
        value={t.customFields ?? []}
        onChange={(cf) => onChange([{ ...t, customFields: cf }])}
      />
    </div>
  );
}

function RodzicPresetFields({ types, onChange }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void }) {
  const parent = types.find((t) => t.name.toLowerCase() === "rodzic") ?? types[0];
  const child = types.find((t) => t.name.toLowerCase() === "dziecko") ?? types[1];
  const discount = child.graduatedPricing?.[0];

  const [parentQuestionsOpen, setParentQuestionsOpen] = useState(false);

  function updateType(id: string, patch: Partial<AttendeeType>) {
    onChange(types.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function toggleDiscount(on: boolean) {
    updateType(child.id, { graduatedPricing: on ? [{ fromQty: 2, priceCents: 0 }] : undefined });
  }
  function setDiscountFrom(v: number) {
    const tier = (child.graduatedPricing ?? [{ fromQty: 2, priceCents: 0 }])[0];
    updateType(child.id, { graduatedPricing: [{ ...tier, fromQty: v }] });
  }
  function setDiscountPrice(v: number) {
    const tier = (child.graduatedPricing ?? [{ fromQty: 2, priceCents: 0 }])[0];
    updateType(child.id, { graduatedPricing: [{ ...tier, priceCents: v }] });
  }

  return (
    <div className="space-y-4">
      <label className="text-sm flex flex-col max-w-xs">
        Cena rodzica (PLN)
        <ZlotyInput valueCents={parent.priceCents}
          onChangeCents={(c) => updateType(parent.id, { priceCents: c })}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex flex-col max-w-xs">
        Cena za dziecko (PLN)
        <ZlotyInput valueCents={child.priceCents}
          onChangeCents={(c) => updateType(child.id, { priceCents: c })}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex flex-col max-w-xs">
        Maksymalna liczba dzieci
        <input type="number" min={1} max={10} value={child.maxQty}
          onChange={(e) => updateType(child.id, { maxQty: Number(e.target.value) })}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={!!discount} onChange={(e) => toggleDiscount(e.target.checked)} />
        Zniżka dla kolejnych dzieci
      </label>
      {discount && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm">od</span>
          <input type="number" min={2} value={discount.fromQty}
            onChange={(e) => setDiscountFrom(Number(e.target.value))}
            className="border rounded px-2 py-1 w-20" />
          <span className="text-sm">-go dziecka, cena (PLN)</span>
          <ZlotyInput valueCents={discount.priceCents}
            onChangeCents={setDiscountPrice}
            className="border rounded px-2 py-1 w-28" />
        </div>
      )}

      <AttendeeCustomFieldsEditor
        heading="Pytania o każde dziecko"
        description="Pojawią się w formularzu zapisu dla każdego dziecka — np. wiek, alergie, dieta, rozmiar ubrania."
        value={child.customFields ?? []}
        onChange={(cf) => updateType(child.id, { customFields: cf })}
      />

      <div>
        <button
          type="button"
          onClick={() => setParentQuestionsOpen(!parentQuestionsOpen)}
          className="text-sm underline text-gray-700"
        >
          {parentQuestionsOpen ? "▾" : "▸"} Pytania o rodzica (opcjonalne)
        </button>
        {parentQuestionsOpen && (
          <div className="mt-3">
            <AttendeeCustomFieldsEditor
              heading="Pytania o rodzica"
              description="Dodatkowe pytania do rodzica — np. nr telefonu kontaktowego w razie sytuacji nagłej. Dane podstawowe (imię, nazwisko, email, telefon) są i tak zbierane przy zapisie."
              value={parent.customFields ?? []}
              onChange={(cf) => updateType(parent.id, { customFields: cf })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

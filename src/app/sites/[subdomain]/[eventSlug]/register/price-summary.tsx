"use client";
import { calculateTotal } from "@/lib/pricing";
import type { AttendeeType } from "@/lib/validators/attendee-types";

type Props = {
  types: AttendeeType[];
  quantities: Record<string, number>;
  depositPerPersonCents: number | null;
  currency?: string;
};

function formatPLN(cents: number): string {
  return (cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł";
}

export function PriceSummary({ types, quantities, depositPerPersonCents }: Props) {
  const calc = calculateTotal(types, quantities);
  if (calc.total === 0) return null;

  const rows = calc.perType.map((pt) => {
    const type = types.find((t) => t.id === pt.typeId)!;
    return {
      name: type.name,
      qty: pt.breakdown.length,
      subtotal: pt.subtotal,
    };
  });

  const totalAttendees = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalDeposit = (depositPerPersonCents ?? 0) * totalAttendees;
  const effectiveDeposit = Math.min(totalDeposit, calc.total);
  const deposit = effectiveDeposit > 0 && effectiveDeposit < calc.total ? effectiveDeposit : null;

  return (
    <div className="rounded-md border p-4 bg-gray-50">
      <h3 className="font-semibold mb-2">Podsumowanie</h3>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.name} className="flex justify-between">
            <span>{r.name} × {r.qty}</span>
            <span>{formatPLN(r.subtotal)}</span>
          </li>
        ))}
        <li className="flex justify-between font-semibold pt-2 border-t">
          <span>Razem</span>
          <span>{formatPLN(calc.total)}</span>
        </li>
        {deposit !== null && (
          <li className="text-xs text-gray-600 pt-1">
            Zaliczka: {formatPLN(deposit)} · Dopłata: {formatPLN(calc.total - deposit)}
          </li>
        )}
      </ul>
    </div>
  );
}

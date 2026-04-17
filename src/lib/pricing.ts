import type { AttendeeType } from "./validators/attendee-types";

export type PriceBreakdownItem = { position: number; priceCents: number };
export type PerTypeSubtotal = {
  typeId: string;
  subtotal: number;
  breakdown: PriceBreakdownItem[];
};
export type PriceCalculation = {
  perType: PerTypeSubtotal[];
  total: number;
};

function priceAtPosition(type: AttendeeType, position: number): number {
  const tiers = [...(type.graduatedPricing ?? [])].sort((a, b) => b.fromQty - a.fromQty);
  for (const tier of tiers) {
    if (position >= tier.fromQty) return tier.priceCents;
  }
  return type.priceCents;
}

export function calculateTotal(
  types: AttendeeType[],
  quantities: Record<string, number>,
): PriceCalculation {
  const perType: PerTypeSubtotal[] = [];
  let total = 0;
  for (const type of types) {
    const qty = quantities[type.id] ?? 0;
    if (qty <= 0) continue;
    const breakdown: PriceBreakdownItem[] = [];
    let subtotal = 0;
    for (let pos = 1; pos <= qty; pos++) {
      const price = priceAtPosition(type, pos);
      breakdown.push({ position: pos, priceCents: price });
      subtotal += price;
    }
    perType.push({ typeId: type.id, subtotal, breakdown });
    total += subtotal;
  }
  return { perType, total };
}

import type { AttendeeType } from "@/lib/validators/attendee-types";
import { formatPlnFromCents } from "@/lib/format-currency";

type Props = {
  attendeeTypes: AttendeeType[] | null;
  legacyPriceCents: number;
  depositPerPersonCents: number | null;
  className?: string;
};

/**
 * Per-type price breakdown shown on public event + registration pages,
 * before we know the group composition. Does NOT show totals or balance
 * due amounts — those depend on headcount and live in PriceSummary.
 */
export function EventPriceSummary({
  attendeeTypes,
  legacyPriceCents,
  depositPerPersonCents,
  className = "",
}: Props) {
  const deposit = depositPerPersonCents ?? 0;

  const rows = buildRows(attendeeTypes, legacyPriceCents);

  return (
    <div className={`rounded-lg border border-border bg-muted/50 p-3 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Cena
      </p>
      <div className="mt-1 space-y-0.5 text-sm font-semibold text-foreground">
        {rows.map((r, i) => (
          <p key={i}>{r}</p>
        ))}
        {deposit > 0 && (
          <p>Zaliczka: {formatPlnFromCents(deposit)} za osobę</p>
        )}
      </div>
    </div>
  );
}

function buildRows(
  types: AttendeeType[] | null,
  legacyPriceCents: number,
): string[] {
  if (!types || types.length === 0) {
    return [`Cena: ${formatPlnFromCents(legacyPriceCents)}`];
  }
  if (types.length === 1) {
    const t = types[0];
    if (t.maxQty <= 1) {
      return [`Cena: ${formatPlnFromCents(t.priceCents)}`];
    }
    return [`Cena: ${formatPlnFromCents(t.priceCents)} za osobę`];
  }
  // Multiple types — list per-type prices, with graduated discount note inline.
  return types.map((t) => {
    const base = `${t.name}: ${formatPlnFromCents(t.priceCents)}`;
    const tier = t.graduatedPricing?.[0];
    if (!tier) return base;
    return `${base} (od ${tier.fromQty}. ${t.name.toLowerCase()}: ${formatPlnFromCents(tier.priceCents)})`;
  });
}

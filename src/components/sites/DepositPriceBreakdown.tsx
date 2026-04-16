import { formatPlnFromCents } from "@/lib/format-currency";

type Props = {
  priceCents: number;
  depositCents: number;
  balanceDueAt: number | null;
  className?: string;
};

/** Całkowita / zaliczka / dopłata — ten sam układ co na stronie wydarzenia. */
export function DepositPriceBreakdown({
  priceCents,
  depositCents,
  balanceDueAt,
  className = "",
}: Props) {
  const remainder = priceCents - depositCents!;
  return (
    <div className={`rounded-lg border border-border bg-muted/50 p-3 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Cena
      </p>
      <div className="mt-1 space-y-0.5 text-sm font-semibold text-foreground">
        <p>Całkowita: {formatPlnFromCents(priceCents)}</p>
        <p>Zaliczka: {formatPlnFromCents(depositCents!)}</p>
        <p>
          Dopłata: {formatPlnFromCents(remainder)}
          {balanceDueAt ? ` do ${new Date(balanceDueAt).toLocaleDateString("pl-PL")}` : ""}
        </p>
      </div>
    </div>
  );
}

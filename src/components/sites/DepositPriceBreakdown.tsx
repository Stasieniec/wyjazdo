import { formatPlnFromCents } from "@/lib/format-currency";

type Props = {
  priceCents: number;
  depositPerPersonCents: number;
  balanceDueAt: number | null;
  className?: string;
};

/**
 * Cena / zaliczka / dopłata per osoba — pokazywane na stronie wydarzenia
 * i w kroku rejestracji, kiedy jeszcze nie znamy liczby uczestników.
 */
export function DepositPriceBreakdown({
  priceCents,
  depositPerPersonCents,
  balanceDueAt,
  className = "",
}: Props) {
  const remainder = Math.max(0, priceCents - depositPerPersonCents);
  return (
    <div className={`rounded-lg border border-border bg-muted/50 p-3 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Cena
      </p>
      <div className="mt-1 space-y-0.5 text-sm font-semibold text-foreground">
        <p>Całkowita: {formatPlnFromCents(priceCents)} / os.</p>
        <p>Zaliczka: {formatPlnFromCents(depositPerPersonCents)} / os.</p>
        <p>
          Dopłata: {formatPlnFromCents(remainder)} / os.
          {balanceDueAt ? ` do ${new Date(balanceDueAt).toLocaleDateString("pl-PL")}` : ""}
        </p>
      </div>
    </div>
  );
}

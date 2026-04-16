/** Polish locale, explicit PLN code (e.g. 123,45 PLN). */
export function formatPlnFromCents(cents: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    currencyDisplay: "code",
  }).format(cents / 100);
}

export function isDepositPricingMode(
  priceCents: number,
  depositCents: number | null,
): boolean {
  return depositCents != null && depositCents > 0 && depositCents < priceCents;
}

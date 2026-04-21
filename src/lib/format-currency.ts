/** Polish locale with "zł" suffix (e.g. 123,45 zł). */
export function formatPlnFromCents(cents: number): string {
  return (
    (cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " zł"
  );
}

export function isDepositPricingMode(
  priceCents: number,
  depositCents: number | null,
): boolean {
  return depositCents != null && depositCents > 0 && depositCents < priceCents;
}

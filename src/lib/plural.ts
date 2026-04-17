/**
 * Polish pluralization for "osoba" (person).
 * - 1        → "osoba"
 * - 2-4      → "osoby" (except 12-14 → "osób")
 * - 5+       → "osób"
 */
export function pluralOsoby(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "osoba";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "osoby";
  return "osób";
}

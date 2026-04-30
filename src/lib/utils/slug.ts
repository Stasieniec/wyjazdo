const MAX_LEN = 32;

export function slugify(input: string): string {
  if (!input) return "";

  // 1. NFD normalize and strip combining marks (handles ó, ą, ę, etc.)
  let s = input.normalize("NFD").replace(/[̀-ͯ]/g, "");

  // 2. Polish-specific chars that don't decompose under NFD
  s = s.replace(/ł/g, "l").replace(/Ł/g, "l");

  // 3. Lowercase
  s = s.toLowerCase();

  // 4. Replace runs of non-alphanumerics with a single dash
  s = s.replace(/[^a-z0-9]+/g, "-");

  // 5. Trim leading/trailing dashes
  s = s.replace(/^-+|-+$/g, "");

  if (s.length <= MAX_LEN) return s;

  // 6. Truncate at a dash boundary if one exists at or before MAX_LEN
  const truncated = s.slice(0, MAX_LEN);
  const lastDash = truncated.lastIndexOf("-");
  if (lastDash > 0) return truncated.slice(0, lastDash);
  return truncated;
}

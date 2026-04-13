export function toCsvRow(fields: ReadonlyArray<string | number | null | undefined>): string {
  return fields
    .map((f) => {
      if (f === null || f === undefined) return "";
      const s = String(f);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}

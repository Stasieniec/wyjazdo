import Link from "next/link";

export function AdminSortHeader({
  label,
  field,
  currentSort,
  currentDir,
  buildHref,
}: {
  label: string;
  field: string;
  currentSort?: string;
  currentDir?: "asc" | "desc";
  buildHref: (sort: string, dir: "asc" | "desc") => string;
}) {
  const active = currentSort === field;
  const nextDir: "asc" | "desc" = active && currentDir === "asc" ? "desc" : "asc";
  const arrow = active ? (currentDir === "asc" ? "↑" : "↓") : "";
  return (
    <Link
      href={buildHref(field, nextDir)}
      className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
    >
      {label}
      <span className="text-[10px]">{arrow}</span>
    </Link>
  );
}

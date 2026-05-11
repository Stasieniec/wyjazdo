import Link from "next/link";

export function AdminPagination({
  page,
  pageSize,
  totalCount,
  buildHref,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;
  return (
    <nav className="flex items-center justify-between text-sm">
      <div className="text-muted-foreground">
        Strona {page} z {totalPages} · {totalCount} pozycji
      </div>
      <div className="flex gap-2">
        {prev ? (
          <Link
            href={buildHref(prev)}
            className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
          >
            ← Poprzednia
          </Link>
        ) : (
          <span className="rounded-md border border-border px-3 py-1.5 text-muted-foreground opacity-50">
            ← Poprzednia
          </span>
        )}
        {next ? (
          <Link
            href={buildHref(next)}
            className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
          >
            Następna →
          </Link>
        ) : (
          <span className="rounded-md border border-border px-3 py-1.5 text-muted-foreground opacity-50">
            Następna →
          </span>
        )}
      </div>
    </nav>
  );
}

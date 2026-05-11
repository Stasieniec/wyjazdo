import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function AdminTopBar({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 sm:px-6">
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/admin" className="font-bold tracking-tight text-primary">
          Wyjazdo Admin
        </Link>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2 text-muted-foreground">
            <span>/</span>
            {c.href ? (
              <Link href={c.href} className="hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="text-foreground">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <form action="/admin/login/logout" method="post">
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Wyloguj
        </button>
      </form>
    </header>
  );
}

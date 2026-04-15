"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Wydarzenia" },
  { href: "/dashboard/finance", label: "Finanse" },
  { href: "/dashboard/settings", label: "Ustawienia" },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/events");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  "rounded-lg px-3 py-2 text-sm font-medium transition-[color,background-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const linkInactive = "text-muted-foreground hover:bg-muted hover:text-foreground";

const linkActive =
  "bg-primary/10 text-primary shadow-[inset_0_-2px_0_0_var(--accent)]";

export function DashboardNav() {
  const pathname = usePathname();
  const mobileDetailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = mobileDetailsRef.current;
    if (el) el.open = false;
  }, [pathname]);

  return (
    <>
      <details ref={mobileDetailsRef} className="group relative sm:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="sr-only">Nawigacja</span>
          <span aria-hidden className="text-base leading-none">
            &#9776;
          </span>
          <span className="max-w-[10rem] truncate text-xs font-medium text-foreground">
            {NAV_ITEMS.find((i) => isNavActive(pathname, i.href))?.label ?? "Menu"}
          </span>
        </summary>
        <nav
          className="absolute left-0 top-full z-50 mt-1.5 flex min-w-[13.5rem] flex-col gap-0.5 rounded-xl border border-border bg-background p-1.5 text-sm shadow-lg"
          aria-label="Nawigacja panelu"
        >
          {NAV_ITEMS.map(({ href, label }) => (
            <NavLink key={href} href={href} label={label} pathname={pathname} />
          ))}
        </nav>
      </details>

      <nav
        className="hidden items-center gap-0.5 text-sm sm:flex"
        aria-label="Nawigacja panelu"
      >
        {NAV_ITEMS.map(({ href, label }) => (
          <NavLink key={href} href={href} label={label} pathname={pathname} />
        ))}
      </nav>
    </>
  );
}

function NavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active = isNavActive(pathname, href);
  return (
    <Link
      href={href}
      className={`${linkBase} ${active ? linkActive : linkInactive}`}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

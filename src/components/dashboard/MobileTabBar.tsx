"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/dashboard",
    label: "Przegląd",
    matchExact: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="16" height="16" rx="3" />
        <path d="M2 7.5h16M7.5 2v16" />
      </svg>
    ),
  },
  {
    href: "/dashboard/events",
    label: "Wydarzenia",
    matchPrefix: "/dashboard/events",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="16" height="14" rx="2" />
        <path d="M2 8h16M6 3V1M14 3V1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/finance",
    label: "Finanse",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 5v5l3.5 2" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Ustawienia",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="3" />
        <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4" />
      </svg>
    ),
  },
] as const;

function isActive(pathname: string, tab: (typeof TABS)[number]): boolean {
  if ("matchExact" in tab && tab.matchExact) return pathname === tab.href;
  if ("matchPrefix" in tab && tab.matchPrefix) return pathname.startsWith(tab.matchPrefix);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
      aria-label="Nawigacja panelu"
    >
      {TABS.map((tab) => {
        const active = isActive(pathname, tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
              active
                ? "text-accent font-semibold"
                : "text-muted-foreground"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className={active ? "text-accent" : "text-muted-foreground"}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

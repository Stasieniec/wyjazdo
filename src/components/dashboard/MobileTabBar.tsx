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
        <rect x="1.5" y="4" width="17" height="12" rx="2" />
        <path d="M1.5 8.5h17" />
        <path d="M5.5 13h3.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Ustawienia",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 1.5h3l.5 2.3a7 7 0 011.4.8l2.2-.9 1.5 2.6-1.7 1.5a7 7 0 010 1.6l1.7 1.5-1.5 2.6-2.2-.9a7 7 0 01-1.4.8l-.5 2.3h-3l-.5-2.3a7 7 0 01-1.4-.8l-2.2.9-1.5-2.6 1.7-1.5a7 7 0 010-1.6L3.4 6.3l1.5-2.6 2.2.9a7 7 0 011.4-.8z" />
        <circle cx="10" cy="10" r="2.75" />
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

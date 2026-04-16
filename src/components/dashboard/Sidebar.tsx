"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";
import { UserMenu } from "@/components/dashboard/UserMenu";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Przegląd",
    matchExact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="1.5" width="15" height="15" rx="3" />
        <path d="M1.5 7h15M7 1.5v15" />
      </svg>
    ),
  },
  {
    href: "/dashboard/events",
    label: "Wydarzenia",
    matchPrefix: "/dashboard/events",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="2.5" width="15" height="13.5" rx="2" />
        <path d="M1.5 7.5h15M5.5 2.5V0.75M12.5 2.5V0.75" />
      </svg>
    ),
  },
  {
    href: "/dashboard/finance",
    label: "Finanse",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="3.5" width="15" height="11" rx="2" />
        <path d="M1.5 7.5h15" />
        <path d="M5 11.5h3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Ustawienia",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 1.5h3l.5 2.1a6 6 0 011.3.7l2-.8 1.5 2.6-1.5 1.4a6 6 0 010 1.5l1.5 1.4-1.5 2.6-2-.8a6 6 0 01-1.3.7l-.5 2.1h-3l-.5-2.1a6 6 0 01-1.3-.7l-2 .8-1.5-2.6 1.5-1.4a6 6 0 010-1.5L2.2 6.1l1.5-2.6 2 .8a6 6 0 011.3-.7z" />
        <circle cx="9" cy="9" r="2.5" />
      </svg>
    ),
  },
] as const;

function isActive(pathname: string, item: (typeof NAV_ITEMS)[number]): boolean {
  if ("matchExact" in item && item.matchExact) {
    return pathname === item.href;
  }
  if ("matchPrefix" in item && item.matchPrefix) {
    return pathname.startsWith(item.matchPrefix);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

interface SidebarProps {
  publicUrl: string | null;
  publicLabel: string | null;
}

export function Sidebar({ publicUrl, publicLabel }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("wyjazdo-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("wyjazdo-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <aside
      className={`hidden sm:flex flex-col bg-primary text-white transition-all duration-200 ${
        collapsed ? "w-16" : "w-[220px]"
      }`}
    >
      {/* Logo */}
      <div className={`px-5 pb-4 pt-5 ${collapsed ? "flex justify-center px-0" : ""}`}>
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <WyjazdoMark className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="text-base font-bold tracking-tight">Wyjazdo</span>
          )}
        </div>
        {!collapsed && publicUrl && publicLabel && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block truncate rounded-lg bg-white/8 px-2.5 py-1.5 text-[11px] text-white/50 transition-colors hover:bg-white/12 hover:text-white/70"
          >
            {publicLabel} <span aria-hidden>↗</span>
          </a>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-3" aria-label="Nawigacja panelu">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg border-l-[3px] px-3 py-2.5 text-[13px] transition-all duration-150 ${
                active
                  ? "border-accent bg-white/12 font-semibold text-white"
                  : "border-transparent text-white/60 hover:bg-white/8 hover:text-white/80"
              } ${collapsed ? "justify-center px-0 border-l-[3px]" : ""}`}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className={`mx-3 mt-4 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition-all hover:border-white/20 hover:bg-white/8 hover:text-white/70 ${
          collapsed ? "justify-center px-0 mx-2 border-transparent" : ""
        }`}
        aria-label={collapsed ? "Rozwiń panel" : "Zwiń panel"}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
        >
          <path d="M10 4L6 8l4 4" />
        </svg>
        {!collapsed && <span>Zwiń panel</span>}
      </button>

      {/* User menu */}
      <div className={`mt-auto border-t border-white/10 px-4 py-3 ${collapsed ? "flex justify-center px-2" : ""}`}>
        <UserMenu />
      </div>
    </aside>
  );
}

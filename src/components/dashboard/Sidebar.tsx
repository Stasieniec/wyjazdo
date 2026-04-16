"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";

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
        <circle cx="9" cy="9" r="7.25" />
        <path d="M9 4.5v4l3 2" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Ustawienia",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="2.5" />
        <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.05 3.05l1.4 1.4M13.55 13.55l1.4 1.4M3.05 14.95l1.4-1.4M13.55 4.45l1.4-1.4" />
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
  userName: string;
  userEmail: string;
  userInitial: string;
}

export function Sidebar({ userName, userEmail, userInitial }: SidebarProps) {
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
      <div className={`flex items-center gap-2 px-5 pb-6 pt-5 ${collapsed ? "justify-center px-0" : ""}`}>
        <WyjazdoMark className="h-7 w-7 shrink-0" />
        {!collapsed && (
          <span className="text-base font-bold tracking-tight">Wyjazdo</span>
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
        className={`mx-3 mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] text-white/40 transition-colors hover:text-white/60 ${
          collapsed ? "justify-center px-0" : ""
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
          className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
        >
          <path d="M10 4L6 8l4 4" />
        </svg>
        {!collapsed && <span>Zwiń panel</span>}
      </button>

      {/* User */}
      <div className={`mt-auto border-t border-white/10 px-4 py-3 ${collapsed ? "flex justify-center px-0" : ""}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/80 text-sm font-bold text-white">
            {userInitial}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{userName}</div>
              <div className="truncate text-[10px] text-white/50">{userEmail}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

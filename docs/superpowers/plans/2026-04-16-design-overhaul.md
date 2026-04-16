# Wyjazdo Design Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the dashboard (collapsible sidebar, new overview page, card refresh) and landing page to make the app bold, energetic, and self-explanatory.

**Architecture:** Pure UI/CSS changes plus one new page and one new layout component. No data model changes. The sidebar replaces the current top-nav DashboardNav, with a new Sidebar client component managing collapse state. The overview page queries existing data (events, finance, participants) to build its cards. The landing page is a full rewrite of `src/app/page.tsx` with the "Clean Reveal" approach.

**Tech Stack:** Next.js App Router, React Server Components, Tailwind CSS 4 (inline @theme), Clerk auth, existing Drizzle ORM queries.

**Spec:** `docs/superpowers/specs/2026-04-16-design-overhaul-design.md`

---

## File Structure

### New files
| File | Purpose |
|------|---------|
| `src/components/dashboard/Sidebar.tsx` | Collapsible navy sidebar — client component managing expanded/collapsed state with localStorage persistence |
| `src/components/dashboard/MobileTabBar.tsx` | Bottom tab bar for mobile — 4 icons with labels |
| `src/components/dashboard/StatCard.tsx` | Reusable stat card (white + navy gradient variants) |
| `src/lib/db/queries/dashboard-overview.ts` | Data queries for the overview page (attention items, recent activity, stats) |

### Modified files
| File | Change |
|------|--------|
| `src/app/globals.css` | Add shadow tokens, transition utility |
| `src/components/ui/Button.tsx` | Add transition, warm shadow on accent variant |
| `src/components/ui/Card.tsx` | Add shadow-sm default, hover shadow-md, ensure rounded-xl |
| `src/app/dashboard/layout.tsx` | Replace header+nav with Sidebar + MobileTabBar, remove max-w-5xl constraint |
| `src/app/dashboard/page.tsx` | Full rewrite — new overview page with stats, action items, activity feed |
| `src/components/dashboard/DashboardEventCard.tsx` | Add navy date block, refresh styling |
| `src/app/dashboard/finance/page.tsx` | Styling pass — apply new Card/shadow/radius patterns |
| `src/app/dashboard/settings/page.tsx` | Styling pass — heading consistency |
| `src/app/page.tsx` | Full rewrite — "Clean Reveal" landing page |

### Deleted files
| File | Reason |
|------|--------|
| `src/components/dashboard/DashboardNav.tsx` | Replaced by Sidebar + MobileTabBar |

---

## Task 1: Design System Refinements (globals.css + Button + Card)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Card.tsx`

- [ ] **Step 1: Add shadow and transition tokens to globals.css**

Add custom shadow values to the `@theme inline` block in `src/app/globals.css`:

```css
/* Add inside the @theme inline { ... } block, after the font lines (line 43): */
  --shadow-warm: 0 2px 8px rgba(232, 104, 58, 0.3);
  --shadow-navy: 0 8px 40px rgba(30, 58, 95, 0.25);
```

- [ ] **Step 2: Update Button.tsx — add transitions and warm shadow to accent variant**

In `src/components/ui/Button.tsx`:

Change the `accent` variant style (line 9) from:
```tsx
"bg-accent text-accent-foreground hover:bg-accent/90",
```
to:
```tsx
"bg-accent text-accent-foreground hover:bg-accent/90 shadow-[--shadow-warm]",
```

Change the base classes string (line 35) from:
```tsx
`inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`
```
to:
```tsx
`inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`
```

- [ ] **Step 3: Update Card.tsx — add shadow and hover transition**

Replace the entire `src/components/ui/Card.tsx` with:

```tsx
import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ padding = "md", className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-background shadow-sm transition-all duration-150 ${paddings[padding]} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Verify the dev server starts without errors**

Run: `cd /home/stas/Desktop/wyjazdo && npm run dev`
Expected: Server starts successfully, no build errors. Visit the existing dashboard to confirm cards now have subtle shadows.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/ui/Button.tsx src/components/ui/Card.tsx
git commit -m "style: add shadow system, transitions to Card and Button"
```

---

## Task 2: Sidebar Component

**Files:**
- Create: `src/components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Create the Sidebar client component**

Create `src/components/dashboard/Sidebar.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd /home/stas/Desktop/wyjazdo && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to Sidebar.tsx.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/Sidebar.tsx
git commit -m "feat: add collapsible navy Sidebar component"
```

---

## Task 3: Mobile Tab Bar Component

**Files:**
- Create: `src/components/dashboard/MobileTabBar.tsx`

- [ ] **Step 1: Create the MobileTabBar client component**

Create `src/components/dashboard/MobileTabBar.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd /home/stas/Desktop/wyjazdo && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to MobileTabBar.tsx.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/MobileTabBar.tsx
git commit -m "feat: add MobileTabBar bottom navigation component"
```

---

## Task 4: Dashboard Layout Overhaul

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Delete: `src/components/dashboard/DashboardNav.tsx` (after layout is updated)

- [ ] **Step 1: Rewrite dashboard layout with sidebar**

Replace the entire content of `src/app/dashboard/layout.tsx` with:

```tsx
import { auth } from "@clerk/nextjs/server";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileTabBar } from "@/components/dashboard/MobileTabBar";
import { UserMenu } from "@/components/dashboard/UserMenu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const organizer = userId ? await getOrganizerByClerkUserId(userId) : null;

  const userName = organizer?.displayName ?? "Organizator";
  const userEmail = organizer?.contactEmail ?? "";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userInitial={userInitial}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Minimal top bar for desktop (user menu + public site link) */}
        <header className="hidden sm:flex items-center justify-end gap-3 border-b border-border bg-background/95 px-6 py-3 supports-[backdrop-filter]:backdrop-blur-md">
          {organizer && (
            <a
              href={`https://${organizer.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[14rem] truncate rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {organizer.subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl"}{" "}
              <span aria-hidden>↗</span>
            </a>
          )}
          <UserMenu />
        </header>

        {/* Mobile header */}
        <header className="flex sm:hidden items-center justify-between border-b border-border bg-background px-4 py-3">
          <span className="text-base font-bold tracking-tight text-primary">Wyjazdo</span>
          <UserMenu />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 pb-20 sm:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar />
    </div>
  );
}
```

- [ ] **Step 2: Delete DashboardNav.tsx**

```bash
rm src/components/dashboard/DashboardNav.tsx
```

- [ ] **Step 3: Remove DashboardNav from any imports**

Search for any remaining imports of `DashboardNav`. The only consumer was `src/app/dashboard/layout.tsx`, which we just rewrote, so there should be none. Verify:

Run: `grep -r "DashboardNav" src/ --include="*.tsx" --include="*.ts"`
Expected: No results.

- [ ] **Step 4: Verify the dev server runs and dashboard renders**

Run: `cd /home/stas/Desktop/wyjazdo && npm run dev`
Expected: Dashboard loads with the navy sidebar on desktop and bottom tab bar on mobile. No build errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/dashboard/layout.tsx src/components/dashboard/
git commit -m "feat: replace top nav with collapsible sidebar and mobile tab bar"
```

---

## Task 5: Overview Data Queries

**Files:**
- Create: `src/lib/db/queries/dashboard-overview.ts`

- [ ] **Step 1: Create the overview queries module**

Create `src/lib/db/queries/dashboard-overview.ts`:

```ts
import { eq, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { countTakenSpots } from "@/lib/capacity";
import { derivedStatus } from "@/lib/participant-status";

export type OverviewStats = {
  activeEventCount: number;
  totalParticipants: number;
  totalRevenueCents: number;
  nearestEvent: {
    id: string;
    title: string;
    startsAt: number;
    taken: number;
    capacity: number;
  } | null;
};

export async function getOverviewStats(organizerId: string): Promise<OverviewStats> {
  const db = getDb();
  const now = Date.now();

  const events = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.organizerId, organizerId))
    .all();

  const activeEvents = events.filter((e) => e.status === "published");

  // Find nearest future event
  const futureEvents = events
    .filter((e) => e.startsAt > now && e.status !== "archived")
    .sort((a, b) => a.startsAt - b.startsAt);

  let nearestEvent: OverviewStats["nearestEvent"] = null;
  if (futureEvents.length > 0) {
    const ne = futureEvents[0];
    const taken = await countTakenSpots(ne.id, now);
    nearestEvent = {
      id: ne.id,
      title: ne.title,
      startsAt: ne.startsAt,
      taken,
      capacity: ne.capacity,
    };
  }

  // Count all active participants and revenue
  const eventIds = events.map((e) => e.id);
  let totalParticipants = 0;
  let totalRevenueCents = 0;

  if (eventIds.length > 0) {
    const participants = await db
      .select()
      .from(schema.participants)
      .where(inArray(schema.participants.eventId, eventIds))
      .all();

    const participantIds = participants.map((p) => p.id);
    const payments =
      participantIds.length > 0
        ? await db
            .select()
            .from(schema.payments)
            .where(inArray(schema.payments.participantId, participantIds))
            .all()
        : [];

    const paymentsByParticipant = new Map<string, typeof payments>();
    for (const pay of payments) {
      const list = paymentsByParticipant.get(pay.participantId) ?? [];
      list.push(pay);
      paymentsByParticipant.set(pay.participantId, list);
    }

    for (const p of participants) {
      const pPayments = paymentsByParticipant.get(p.id) ?? [];
      const ds = derivedStatus(p, pPayments, now);
      if (ds === "paid" || ds === "deposit_paid") {
        totalParticipants += 1;
        totalRevenueCents += pPayments
          .filter((pay) => pay.status === "succeeded")
          .reduce((sum, pay) => sum + pay.amountCents, 0);
      }
    }
  }

  return {
    activeEventCount: activeEvents.length,
    totalParticipants,
    totalRevenueCents,
    nearestEvent,
  };
}

export type AttentionItem = {
  eventId: string;
  eventTitle: string;
  type: "unpaid" | "waitlist" | "full";
  count: number;
  description: string;
};

export async function getAttentionItems(organizerId: string): Promise<AttentionItem[]> {
  const db = getDb();
  const now = Date.now();

  const events = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.organizerId, organizerId))
    .all();

  const items: AttentionItem[] = [];

  for (const event of events) {
    if (event.status === "archived") continue;

    const participants = await db
      .select()
      .from(schema.participants)
      .where(eq(schema.participants.eventId, event.id))
      .all();

    const participantIds = participants.map((p) => p.id);
    const payments =
      participantIds.length > 0
        ? await db
            .select()
            .from(schema.payments)
            .where(inArray(schema.payments.participantId, participantIds))
            .all()
        : [];

    const paymentsByParticipant = new Map<string, typeof payments>();
    for (const pay of payments) {
      const list = paymentsByParticipant.get(pay.participantId) ?? [];
      list.push(pay);
      paymentsByParticipant.set(pay.participantId, list);
    }

    let unpaidCount = 0;
    let waitlistCount = 0;
    let taken = 0;

    for (const p of participants) {
      const pPayments = paymentsByParticipant.get(p.id) ?? [];
      const ds = derivedStatus(p, pPayments, now);
      if (ds === "pending" || ds === "overdue") unpaidCount += 1;
      if (ds === "waitlisted") waitlistCount += 1;
      if (["pending", "deposit_paid", "paid", "overdue"].includes(ds)) taken += 1;
    }

    if (unpaidCount > 0) {
      items.push({
        eventId: event.id,
        eventTitle: event.title,
        type: "unpaid",
        count: unpaidCount,
        description: `${unpaidCount} ${unpaidCount === 1 ? "nieopłacony zapis" : "nieopłacone zapisy"}`,
      });
    }

    if (waitlistCount > 0) {
      items.push({
        eventId: event.id,
        eventTitle: event.title,
        type: "waitlist",
        count: waitlistCount,
        description: `${waitlistCount} ${waitlistCount === 1 ? "osoba" : "osoby"} na liście rezerwowej`,
      });
    }

    if (event.capacity > 0 && taken >= event.capacity && unpaidCount === 0 && waitlistCount === 0) {
      items.push({
        eventId: event.id,
        eventTitle: event.title,
        type: "full",
        count: taken,
        description: "wypełnione!",
      });
    }
  }

  // Sort: unpaid first, then waitlist, then full
  const order = { unpaid: 0, waitlist: 1, full: 2 };
  return items.sort((a, b) => order[a.type] - order[b.type]);
}

export type RecentActivity = {
  participantId: string;
  firstName: string;
  lastName: string;
  eventTitle: string;
  eventId: string;
  type: "signup" | "payment" | "cancellation";
  timestamp: number;
};

export async function getRecentActivity(
  organizerId: string,
  limit = 5,
): Promise<RecentActivity[]> {
  const db = getDb();

  // Get recent participants (signups) for this organizer's events
  const rows = await db
    .select({
      participantId: schema.participants.id,
      firstName: schema.participants.firstName,
      lastName: schema.participants.lastName,
      lifecycleStatus: schema.participants.lifecycleStatus,
      createdAt: schema.participants.createdAt,
      eventId: schema.events.id,
      eventTitle: schema.events.title,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .where(eq(schema.events.organizerId, organizerId))
    .orderBy(desc(schema.participants.createdAt))
    .limit(limit * 2) // Fetch extra to have room after filtering
    .all();

  const activities: RecentActivity[] = rows.map((r) => ({
    participantId: r.participantId,
    firstName: r.firstName,
    lastName: r.lastName,
    eventTitle: r.eventTitle,
    eventId: r.eventId,
    type: r.lifecycleStatus === "cancelled" ? "cancellation" : "signup",
    timestamp: r.createdAt,
  }));

  return activities.slice(0, limit);
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd /home/stas/Desktop/wyjazdo && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries/dashboard-overview.ts
git commit -m "feat: add overview data queries (stats, attention items, activity)"
```

---

## Task 6: StatCard Component

**Files:**
- Create: `src/components/dashboard/StatCard.tsx`

- [ ] **Step 1: Create the StatCard component**

Create `src/components/dashboard/StatCard.tsx`:

```tsx
interface StatCardProps {
  label: string;
  children: React.ReactNode;
  subtitle?: string;
  variant?: "default" | "navy";
  className?: string;
}

export function StatCard({
  label,
  children,
  subtitle,
  variant = "default",
  className = "",
}: StatCardProps) {
  const isNavy = variant === "navy";

  return (
    <div
      className={`rounded-xl p-4 sm:p-5 ${
        isNavy
          ? "bg-gradient-to-br from-primary to-[#2d5a8a] text-white"
          : "border border-border bg-background shadow-sm"
      } ${className}`}
    >
      <div
        className={`text-[10px] font-medium uppercase tracking-wider ${
          isNavy ? "text-white/70" : "text-muted-foreground"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${
          isNavy ? "text-white" : "text-primary"
        }`}
      >
        {children}
      </div>
      {subtitle && (
        <div
          className={`mt-1 text-xs ${
            isNavy ? "text-white/60" : "text-muted-foreground"
          }`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/StatCard.tsx
git commit -m "feat: add StatCard component (default + navy gradient variants)"
```

---

## Task 7: Overview Page (Przegląd)

**Files:**
- Modify: `src/app/dashboard/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the dashboard home page as the overview**

Replace the entire content of `src/app/dashboard/page.tsx` with:

```tsx
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import {
  getOverviewStats,
  getAttentionItems,
  getRecentActivity,
} from "@/lib/db/queries/dashboard-overview";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatPlnFromCents } from "@/lib/format-currency";

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "wczoraj" : `${days} dni temu`;
}

function formatDaysUntil(startsAt: number): string {
  const diff = startsAt - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "dzisiaj";
  if (days === 1) return "jutro";
  return `za ${days} dni`;
}

export default async function DashboardOverview() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  const [stats, attentionItems, recentActivity] = await Promise.all([
    getOverviewStats(organizer.id),
    getAttentionItems(organizer.id),
    getRecentActivity(organizer.id, 5),
  ]);

  const firstName = organizer.displayName.split(" ")[0];
  const today = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            Dzień dobry, {firstName} 👋
          </h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{today}</p>
        </div>
        <Link
          href="/dashboard/events/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
        >
          + Nowe wydarzenie
        </Link>
      </div>

      {/* Stripe onboarding warning */}
      {(organizer.stripeOnboardingComplete !== 1 ||
        organizer.stripePayoutsEnabled !== 1) && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Dokończ konfigurację Stripe, aby móc publikować wydarzenia.{" "}
          <Link
            href="/dashboard/onboarding/payouts"
            className="font-medium underline"
          >
            Konfiguruj
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Przychód"
          variant="navy"
          subtitle={`${stats.totalParticipants} uczestników łącznie`}
          className="sm:col-span-2 lg:col-span-1"
        >
          {formatPlnFromCents(stats.totalRevenueCents)}
        </StatCard>
        <StatCard label="Aktywne wydarzenia" subtitle="opublikowanych">
          {stats.activeEventCount}
        </StatCard>
        {stats.nearestEvent ? (
          <StatCard
            label="Najbliższe wydarzenie"
            subtitle={`${formatDaysUntil(stats.nearestEvent.startsAt)} · ${stats.nearestEvent.taken}/${stats.nearestEvent.capacity} miejsc`}
          >
            <span className="text-base font-bold sm:text-lg">{stats.nearestEvent.title}</span>
          </StatCard>
        ) : (
          <StatCard label="Najbliższe wydarzenie" subtitle="brak nadchodzących">
            —
          </StatCard>
        )}
      </div>

      {/* Attention items */}
      {attentionItems.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Wymaga uwagi</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
            {attentionItems.map((item, i) => (
              <div
                key={`${item.eventId}-${item.type}`}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < attentionItems.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      item.type === "unpaid"
                        ? "bg-accent"
                        : item.type === "waitlist"
                          ? "bg-amber-500"
                          : "bg-success"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground">{item.eventTitle}</span>
                    <span className="text-muted-foreground"> — {item.description}</span>
                  </div>
                </div>
                {item.type !== "full" ? (
                  <Link
                    href={`/dashboard/events/${item.eventId}?tab=uczestnicy`}
                    className="shrink-0 text-xs font-semibold text-accent transition-colors hover:text-accent/80"
                  >
                    Sprawdź →
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Gotowe ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Ostatnia aktywność</h2>
          <div className="mt-3 flex flex-col gap-2">
            {recentActivity.map((activity) => (
              <div
                key={activity.participantId}
                className="flex items-center gap-2 text-sm"
              >
                <div
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    activity.type === "cancellation"
                      ? "bg-amber-500"
                      : "bg-success"
                  }`}
                />
                <span className="min-w-0 text-foreground">
                  {activity.type === "cancellation" ? "Anulowanie" : "Nowy zapis"} —{" "}
                  <strong>
                    {activity.firstName} {activity.lastName}
                  </strong>{" "}
                  → {activity.eventTitle}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {relativeTime(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — no events at all */}
      {stats.activeEventCount === 0 && attentionItems.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-background p-8 text-center shadow-sm">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Twoje pierwsze wydarzenie
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Jeszcze nie masz żadnych wydarzeń. Stwórz pierwsze — w kilka minut
            zbudujesz stronę, zaczniesz zbierać zapisy i płatności online.
          </p>
          <Link
            href="/dashboard/events/new"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all hover:bg-accent/90"
          >
            + Utwórz wydarzenie
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the overview page renders**

Run: `cd /home/stas/Desktop/wyjazdo && npm run dev`
Expected: Visit `/dashboard` — the overview page shows the greeting, stats, attention items (if any events exist), and activity feed.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: new overview page with stats, attention items, activity feed"
```

---

## Task 8: Wydarzenia (Events List) Page — New Route + Card Refresh

**Files:**
- Create: `src/app/dashboard/events/page.tsx`
- Modify: `src/components/dashboard/DashboardEventCard.tsx`

The overview page now lives at `/dashboard`. The events list needs its own route at `/dashboard/events`.

- [ ] **Step 1: Create the events list page**

Create `src/app/dashboard/events/page.tsx`:

```tsx
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { countTakenSpots } from "@/lib/capacity";
import { DashboardEventCard } from "@/components/dashboard/DashboardEventCard";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { listEventsForOrganizer } from "@/lib/db/queries/events-dashboard";

export default async function EventsListPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  const events = await listEventsForOrganizer(organizer.id);
  const nowMs = Date.now();
  const eventsWithTaken = await Promise.all(
    events.map(async (e) => ({
      ...e,
      taken: await countTakenSpots(e.id, nowMs),
    })),
  );

  return (
    <div>
      {(organizer.stripeOnboardingComplete !== 1 ||
        organizer.stripePayoutsEnabled !== 1) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 mb-6">
          Dokończ konfigurację Stripe, aby móc publikować wydarzenia.{" "}
          <Link
            href="/dashboard/onboarding/payouts"
            className="underline font-medium"
          >
            Konfiguruj
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Wydarzenia</h1>
        <Link
          href="/dashboard/events/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
        >
          + Nowe wydarzenie
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-background p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Brak wydarzeń</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Stwórz pierwsze wydarzenie — w kilka minut zbudujesz stronę, zaczniesz
            zbierać zapisy i płatności online.
          </p>
          <Link
            href="/dashboard/events/new"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all hover:bg-accent/90"
          >
            + Utwórz wydarzenie
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid list-none gap-4 p-0">
          {eventsWithTaken.map((e) => (
            <li key={e.id}>
              <DashboardEventCard
                id={e.id}
                title={e.title}
                startsAt={e.startsAt}
                taken={e.taken}
                capacity={e.capacity}
                location={e.location}
                status={e.status}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Refresh DashboardEventCard styling with date blocks**

Replace the entire content of `src/components/dashboard/DashboardEventCard.tsx` with:

```tsx
import Link from "next/link";
import { Button, StatusBadge } from "@/components/ui";

type EventStatus = "draft" | "published" | "archived";

type DashboardEventCardProps = {
  id: string;
  title: string;
  startsAt: number;
  taken: number;
  capacity: number;
  location: string | null;
  status: EventStatus;
};

const MONTHS_PL = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];

export function DashboardEventCard({
  id,
  title,
  startsAt,
  taken,
  capacity,
  location,
  status,
}: DashboardEventCardProps) {
  const editHref = `/dashboard/events/${id}`;
  const participantsHref = `/dashboard/events/${id}?tab=uczestnicy`;
  const isFull = capacity > 0 && taken >= capacity;

  const date = new Date(startsAt);
  const day = date.getDate();
  const month = MONTHS_PL[date.getMonth()];

  const dateStr = date.toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="rounded-xl border border-border bg-background shadow-sm transition-all duration-150 hover:shadow-md">
      <div className="flex items-center gap-4 p-4 sm:gap-5">
        {/* Date block */}
        <div className="hidden sm:flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#2d5a8a] text-white">
          <span className="text-[10px] font-semibold uppercase leading-none">{month}</span>
          <span className="text-lg font-bold leading-none">{day}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {isFull && (
              <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                Wypełnione
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-base font-semibold leading-snug text-foreground">
            <Link
              href={editHref}
              className="transition-colors hover:text-primary"
            >
              {title}
            </Link>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>{dateStr}</span>
            {location && (
              <>
                <span className="text-border" aria-hidden>·</span>
                <span className="truncate">{location}</span>
              </>
            )}
            <span className="text-border" aria-hidden>·</span>
            <span>
              <span className="tabular-nums font-medium text-foreground">{taken}</span>
              /{capacity} miejsc
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
          <Button href={editHref} variant="secondary" size="sm">
            Edytuj
          </Button>
          <Button href={participantsHref} variant="accent" size="sm">
            Uczestnicy
          </Button>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Verify both pages render**

Run: `cd /home/stas/Desktop/wyjazdo && npm run dev`
Expected: `/dashboard` shows the overview, `/dashboard/events` shows the events list with date blocks. Sidebar highlights the correct page.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/events/page.tsx src/components/dashboard/DashboardEventCard.tsx
git commit -m "feat: events list page at /dashboard/events with refreshed card design"
```

---

## Task 9: Finance + Settings Styling Pass

**Files:**
- Modify: `src/app/dashboard/finance/page.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Update finance page headings and warning banner styling**

In `src/app/dashboard/finance/page.tsx`, make these changes:

Change the h1 element (line 58) from:
```tsx
<h1 className="text-2xl font-semibold tracking-tight">Finanse</h1>
```
to:
```tsx
<h1 className="text-xl font-bold sm:text-2xl">Finanse</h1>
```

Change the Stripe warning card (line 69) from:
```tsx
<Card className="mt-4" padding="lg">
```
to:
```tsx
<Card className="mt-4 border-amber-300 bg-amber-50" padding="lg">
```

Change the payout button (lines 138-142) from:
```tsx
<button
  type="submit"
  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
>
```
to:
```tsx
<button
  type="submit"
  className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
>
```

Change the empty state Card (line 226) from:
```tsx
<Card className="mt-8 text-center" padding="lg">
```
to:
```tsx
<Card className="mt-8 text-center shadow-sm" padding="lg">
```

- [ ] **Step 2: Update settings page heading**

In `src/app/dashboard/settings/page.tsx`, change the h1 (line 18) from:
```tsx
<h1 className="text-2xl font-semibold">Ustawienia</h1>
```
to:
```tsx
<h1 className="text-xl font-bold sm:text-2xl">Ustawienia</h1>
```

- [ ] **Step 3: Verify both pages render with updated styles**

Run: `cd /home/stas/Desktop/wyjazdo && npm run dev`
Expected: Finance and Settings pages have consistent headings, updated button styles, and shadow on cards.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/finance/page.tsx src/app/dashboard/settings/page.tsx
git commit -m "style: finance and settings page styling pass"
```

---

## Task 10: Landing Page Rewrite

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the landing page with the "Clean Reveal" design**

Replace the entire content of `src/app/page.tsx` with:

```tsx
import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { siteOrigin } from "@/lib/urls";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Wyjazdo",
  alternateName: "wyjazdo.pl",
  url: siteOrigin(),
  description:
    "Platforma dla organizatorów wyjazdów, retreatów i warsztatów — zapisy, płatności online i panel uczestników.",
  inLanguage: "pl-PL",
  publisher: {
    "@type": "Organization",
    name: "Wyjazdo",
    url: siteOrigin(),
    logo: `${siteOrigin()}/logo.png`,
  },
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-primary"
          >
            <WyjazdoMark className="h-8 w-8 shrink-0" />
            wyjazdo
          </Link>
          <Show when="signed-out">
            <div className="flex items-center gap-3 text-sm">
              <Link
                href="/sign-in"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Zaloguj się
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
              >
                Wypróbuj za darmo
              </Link>
            </div>
          </Show>
          <Show when="signed-in">
            <div className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
              >
                Panel organizatora
              </Link>
              <UserMenu />
            </div>
          </Show>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 pt-16 pb-4 sm:pt-24 sm:pb-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
            Dla organizatorów wyjazdów grupowych
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Organizujesz wyjazdy?
            <br />
            <span className="text-accent">My ogarniamy resztę.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Zapisy, płatności, uczestnicy — jedno narzędzie zamiast dziesięciu
            arkuszy.
          </p>
          <div className="mt-8">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="inline-flex items-center rounded-xl bg-accent px-8 py-4 text-base font-semibold text-white shadow-[--shadow-warm] transition-all hover:bg-accent/90"
              >
                Zacznij za darmo →
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-xl bg-accent px-8 py-4 text-base font-semibold text-white shadow-[--shadow-warm] transition-all hover:bg-accent/90"
              >
                Przejdź do panelu →
              </Link>
            </Show>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Bez karty kredytowej · Gotowe w 5 minut
          </p>
        </div>
      </section>

      {/* ── Dashboard screenshot ── */}
      <section className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-primary p-2 shadow-[--shadow-navy] sm:p-3">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-2 pb-2">
              <div className="h-2 w-2 rounded-full bg-white/30" />
              <div className="h-2 w-2 rounded-full bg-white/30" />
              <div className="h-2 w-2 rounded-full bg-white/30" />
              <div className="ml-3 flex-1 rounded-md bg-white/10 px-3 py-1">
                <span className="text-[10px] text-white/40 sm:text-xs">
                  app.wyjazdo.pl/dashboard
                </span>
              </div>
            </div>
            {/* Dashboard mockup content */}
            <div className="rounded-xl bg-[#FAFAFA] p-3 sm:p-4">
              <div className="flex gap-3">
                {/* Mini sidebar */}
                <div className="hidden sm:flex w-36 shrink-0 flex-col rounded-xl bg-primary p-3">
                  <div className="flex items-center gap-1.5 pb-4">
                    <div className="h-4 w-4 rounded bg-accent" />
                    <div className="h-1.5 w-12 rounded bg-white/60" />
                  </div>
                  <div className="mb-2 rounded-lg bg-white/12 border-l-2 border-accent px-2 py-1.5">
                    <div className="h-1 w-14 rounded bg-white/60" />
                  </div>
                  <div className="mb-2 px-2 py-1.5">
                    <div className="h-1 w-16 rounded bg-white/25" />
                  </div>
                  <div className="mb-2 px-2 py-1.5">
                    <div className="h-1 w-12 rounded bg-white/25" />
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="h-1 w-14 rounded bg-white/25" />
                  </div>
                </div>
                {/* Mini content */}
                <div className="flex-1 space-y-3">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-gradient-to-br from-primary to-[#2d5a8a] p-2.5 text-white">
                      <div className="h-1 w-10 rounded bg-white/40 mb-1.5" />
                      <div className="h-3 w-14 rounded bg-white/80" />
                    </div>
                    <div className="rounded-lg border border-border bg-white p-2.5">
                      <div className="h-1 w-10 rounded bg-border mb-1.5" />
                      <div className="h-3 w-6 rounded bg-primary/70" />
                    </div>
                    <div className="rounded-lg border border-border bg-white p-2.5">
                      <div className="h-1 w-12 rounded bg-border mb-1.5" />
                      <div className="h-2 w-16 rounded bg-foreground/60" />
                    </div>
                  </div>
                  {/* Action items */}
                  <div className="rounded-lg border border-border bg-white p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <div className="h-1 w-24 rounded bg-foreground/30" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <div className="h-1 w-28 rounded bg-foreground/30" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success" />
                      <div className="h-1 w-20 rounded bg-foreground/30" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust line ── */}
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Już ponad{" "}
          <strong className="font-semibold text-primary">200 wyjazdów</strong>{" "}
          zorganizowanych z Wyjazdo
        </p>
      </div>

      {/* ── Benefits ── */}
      <section className="px-6 py-12 sm:py-16">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 10h18" />
                <path d="M9 4v6" />
              </svg>
            }
            title="Formularz zapisów"
            description="Uczestnicy zapisują się sami. Ty dostajesz powiadomienie."
          />
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
                <path d="M6 15h4" />
              </svg>
            }
            title="Automatyczne płatności"
            description="Linki do płatności wysyłają się same. Koniec z pilnowaniem przelewów."
          />
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3.5" />
                <path d="M2 21c0-4.418 3.134-8 7-8s7 3.582 7 8" />
                <path d="M16 3.5c1.657 0 3 1.567 3 3.5s-1.343 3.5-3 3.5" />
                <path d="M19 14c2.21 1.333 3.5 3.667 3.5 7" />
              </svg>
            }
            title="Pełen obraz"
            description="Kto zapłacił, kto nie, kto czeka — wszystko w jednym widoku."
          />
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <QuoteIcon className="mx-auto mb-6 h-8 w-8 text-accent/30" />
          <blockquote>
            <p className="text-xl font-medium leading-relaxed text-foreground sm:text-2xl">
              Wyjazdo oszczędza mi godziny każdego miesiąca. Jeden link
              i&nbsp;uczestnicy sami się zapisują i&nbsp;płacą — bez żadnych
              telefonów ani&nbsp;maili.
            </p>
            <footer className="mt-6">
              <div className="font-semibold text-foreground">Marta Kowalska</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Organizatorka retreatów jogi, Kraków
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="relative overflow-hidden bg-primary px-6 py-20 sm:py-24">
        {/* Dot texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Coral glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] translate-x-1/3 -translate-y-1/4 rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Gotowa, żeby uprościć organizację?
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Załóż konto w&nbsp;minutę. Bez opłat startowych, bez karty.
          </p>
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center rounded-xl bg-accent px-8 py-4 font-semibold text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent/90"
            >
              Zacznij za darmo
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="mt-8 inline-flex items-center rounded-xl bg-accent px-8 py-4 font-semibold text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent/90"
            >
              Przejdź do panelu
            </Link>
          </Show>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-white px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <WyjazdoMark className="h-6 w-6" />
              wyjazdo.pl
            </Link>
            <nav className="flex gap-6 text-xs text-muted-foreground">
              <Link
                href="/regulamin"
                className="transition-colors hover:text-foreground"
              >
                Regulamin
              </Link>
              <Link
                href="/polityka-prywatnosci"
                className="transition-colors hover:text-foreground"
              >
                Polityka prywatności
              </Link>
            </nav>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} wyjazdo.pl
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent sm:mx-0">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M0 16.571C0 10.187 3.738 5.155 11.214 1.472L13.333 4.8C9.124 7.04 6.857 9.813 6.476 13.12H10.667V24H0V16.571ZM18.667 16.571C18.667 10.187 22.405 5.155 29.881 1.472L32 4.8C27.791 7.04 25.524 9.813 25.143 13.12H29.333V24H18.667V16.571Z" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify the landing page renders**

Run: `cd /home/stas/Desktop/wyjazdo && npm run dev`
Expected: Visit `/` — the landing page shows the Clean Reveal design with centered hero, dashboard screenshot mockup, trust line, 3 benefits, testimonial, navy CTA band, and footer. All text is in Polish.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: landing page redesign — Clean Reveal with dashboard preview"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd /home/stas/Desktop/wyjazdo && npx tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 2: Run linter**

Run: `cd /home/stas/Desktop/wyjazdo && npx next lint`
Expected: No errors (or only pre-existing warnings).

- [ ] **Step 3: Test all dashboard pages in browser**

Start dev server and manually visit:
- `/` — Landing page (Clean Reveal design)
- `/dashboard` — Overview with stats, attention items, activity
- `/dashboard/events` — Events list with date blocks
- `/dashboard/finance` — Finance with refreshed styling
- `/dashboard/settings` — Settings with consistent heading
- Test sidebar collapse/expand on desktop
- Test mobile bottom tab bar (resize browser to < 640px)

- [ ] **Step 4: Add .superpowers to .gitignore if not already there**

Run: `grep -q "^\.superpowers" .gitignore || echo ".superpowers/" >> .gitignore`

- [ ] **Step 5: Commit any remaining changes**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```

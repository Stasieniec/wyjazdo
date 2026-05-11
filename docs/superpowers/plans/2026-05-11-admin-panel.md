# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only, password-gated admin panel at `/admin` that lets the platform owner monitor organizers, events, participants, and payments across the entire Wyjazdo platform.

**Architecture:** Next.js 16 server components under `src/app/admin/`, gated by a stateless HMAC-signed cookie verified by a `requireAdmin()` helper. All data via new Drizzle queries in `src/lib/db/queries/admin.ts` that aggregate across all tenants. No mutations, no Clerk involvement, no separate subdomain.

**Tech Stack:** Next.js 16 (App Router, server components, server actions), Drizzle ORM on Cloudflare D1, Tailwind CSS, Web Crypto API for HMAC, Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-05-11-admin-panel-design.md`

**Reference patterns in this repo (read these first):**
- `src/lib/participant-auth.ts` — cookie/HMAC pattern to mirror for `admin-auth.ts`.
- `src/lib/participant-auth.test.ts` — vitest pattern for auth round-trip tests.
- `src/lib/db/queries/dashboard-overview.ts` — aggregation pattern (note: timestamps are stored as `Date.now()` milliseconds, NOT seconds).
- `src/lib/db/queries/organizers.ts` — basic Drizzle query patterns.
- `src/lib/rate-limit.ts` — sliding-window rate limiter; use `checkRateLimit(key)`.
- `src/components/dashboard/StatCard.tsx` — reusable stat card (use directly, do NOT fork).
- `src/lib/format-currency.ts` — `formatPlnFromCents(cents)` is the function name.
- `src/middleware.ts` — middleware to update so `/admin` skips Clerk and tenant rewrite.
- `src/lib/tenant.ts` — `resolveTenant(host, root)` returns `{ kind: 'apex' | 'tenant' | 'unknown' }`.

**Conventions to follow:**
- Timestamps stored as **milliseconds** (`Date.now()`) in all integer date columns. `daysAgoMs(n) = Date.now() - n * 86_400_000`.
- All Polish UI text (matches the rest of the product).
- All currency formatted via `formatPlnFromCents`.
- Server components for everything — no client components unless interactivity requires it (the participant-detail expand uses a `<details>` element, no JS).
- DB access only via `getDb()` from `src/lib/db/client.ts`.
- Cloudflare env access only via `getCloudflareContext()` from `@opennextjs/cloudflare`. Cast unknown env keys: `(env as unknown as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD`.

---

## File Structure

**Create:**
- `src/lib/admin-auth.ts` — sign/verify helpers, `requireAdmin()`, env accessors.
- `src/lib/admin-auth.test.ts` — vitest unit tests for sign/verify.
- `src/lib/db/queries/admin.ts` — all admin queries (stats, lists, details).
- `src/components/admin/AdminTopBar.tsx` — top bar with breadcrumbs + logout.
- `src/components/admin/AdminTable.tsx` — styled `<table>` wrapper.
- `src/components/admin/AdminSortHeader.tsx` — sortable column header.
- `src/components/admin/AdminPagination.tsx` — prev/next/page-number nav.
- `src/components/admin/AdminSearchForm.tsx` — `<form>` GET search input.
- `src/components/admin/RecentOrganizersList.tsx` — overview widget.
- `src/components/admin/RecentPaymentsList.tsx` — overview widget.
- `src/components/admin/AdminParticipantRow.tsx` — `<details>` expandable row.
- `src/app/admin/layout.tsx` — admin chrome; calls `requireAdmin()` except on `/admin/login`.
- `src/app/admin/page.tsx` — overview.
- `src/app/admin/login/page.tsx` — login form.
- `src/app/admin/login/actions.ts` — `loginAction`, `logoutAction`.
- `src/app/admin/organizers/page.tsx` — list.
- `src/app/admin/organizers/[organizerId]/page.tsx` — organizer detail.
- `src/app/admin/organizers/[organizerId]/events/[eventId]/page.tsx` — event detail.

**Modify:**
- `src/middleware.ts` — short-circuit `/admin` on the apex; 404 `/admin` on tenant subdomains.
- `src/lib/validators/organizer.ts` — add `"admin"` to `RESERVED_SUBDOMAINS` (so `admin.wyjazdo.pl` can't be registered).
- `src/app/robots.ts` — disallow `/admin`.
- `cloudflare-env.d.ts` — will be regenerated via `npm run cf-typegen` once secrets exist.

---

## Implementation Order

The plan runs bottom-up: env config → auth helpers → middleware → queries → UI shell → overview → list → detail pages. This lets each layer be testable in isolation, and the UI tasks all have working data underneath them when they run.

---

## Task 1: Reserve the `admin` subdomain

**Files:**
- Modify: `src/lib/validators/organizer.ts`

- [ ] **Step 1: Add `"admin"` to the reserved list**

In `src/lib/validators/organizer.ts`, locate the `RESERVED_SUBDOMAINS` set. The existing definition starts with `// Current app routes (must not be claimable — would shadow root pages)` and lists `"dashboard", "onboarding", "my-trips", "pomoc"`. Add `"admin"` to that same line:

```ts
"dashboard", "onboarding", "my-trips", "pomoc", "admin",
```

- [ ] **Step 2: Run the existing organizer validator tests**

Run: `npx vitest run src/lib/validators` (or `npm test` if no validator-specific test exists)
Expected: PASS — adding to a set should not break any existing tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validators/organizer.ts
git commit -m "feat(admin): reserve 'admin' subdomain"
```

---

## Task 2: Disallow `/admin` in robots.txt

**Files:**
- Modify: `src/app/robots.ts`

- [ ] **Step 1: Update robots config**

Replace the body of `src/app/robots.ts` with:

```ts
import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/robots.ts
git commit -m "feat(admin): disallow /admin in robots.txt"
```

---

## Task 3: Auth helper — test the sign/verify round-trip first

**Files:**
- Create: `src/lib/admin-auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin-auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  signAdminSession,
  verifyAdminSession,
  constantTimeStringEq,
} from "./admin-auth";

const SECRET = "test-secret-please-rotate-abcdef1234567890";

describe("admin session cookie", () => {
  it("signs and verifies a fresh cookie", async () => {
    const issuedAtMs = 1_700_000_000_000;
    const cookie = await signAdminSession(issuedAtMs, SECRET);
    const result = await verifyAdminSession(cookie, SECRET, issuedAtMs + 1000);
    expect(result).toEqual({ issuedAtMs });
  });

  it("rejects a cookie past 7-day TTL", async () => {
    const issuedAtMs = 1_700_000_000_000;
    const cookie = await signAdminSession(issuedAtMs, SECRET);
    const sevenDaysOneSecondLater = issuedAtMs + 7 * 86_400_000 + 1000;
    expect(await verifyAdminSession(cookie, SECRET, sevenDaysOneSecondLater)).toBeNull();
  });

  it("rejects a cookie with a tampered signature", async () => {
    const cookie = await signAdminSession(1_700_000_000_000, SECRET);
    const [body] = cookie.split(".");
    const tampered = `${body}.deadbeef`;
    expect(await verifyAdminSession(tampered, SECRET, 1_700_000_000_001)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const cookie = await signAdminSession(1_700_000_000_000, SECRET);
    expect(await verifyAdminSession(cookie, "other-secret-xyz", 1_700_000_000_001)).toBeNull();
  });

  it("rejects malformed cookies", async () => {
    expect(await verifyAdminSession("", SECRET, 1)).toBeNull();
    expect(await verifyAdminSession("no-dot", SECRET, 1)).toBeNull();
    expect(await verifyAdminSession(".only-sig", SECRET, 1)).toBeNull();
    expect(await verifyAdminSession("only-body.", SECRET, 1)).toBeNull();
  });
});

describe("constantTimeStringEq", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeStringEq("abc", "abc")).toBe(true);
  });
  it("returns false for differing strings of same length", () => {
    expect(constantTimeStringEq("abc", "abd")).toBe(false);
  });
  it("returns false for strings of different length", () => {
    expect(constantTimeStringEq("abc", "abcd")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: FAIL — module `./admin-auth` does not exist yet.

---

## Task 4: Auth helper — implement sign / verify / constant-time

**Files:**
- Create: `src/lib/admin-auth.ts`

- [ ] **Step 1: Write the implementation**

Create `src/lib/admin-auth.ts`:

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

// HMAC-SHA256 signed admin session cookie. Stateless: no DB lookup.
// Format: `${issuedAtMs}.${hmac_base64url}`. TTL enforced at verify time.

export const ADMIN_SESSION_TTL_MS = 7 * 86_400_000; // 7 days
export const ADMIN_SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60_000; // 24h
export const ADMIN_SESSION_COOKIE = "admin_session";

const enc = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bytesToBase64Url(new Uint8Array(sig));
}

function bytesToBase64Url(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function constantTimeStringEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signAdminSession(issuedAtMs: number, secret: string): Promise<string> {
  const body = String(issuedAtMs);
  const sig = await hmac(secret, `admin:${body}`);
  return `${body}.${sig}`;
}

export async function verifyAdminSession(
  cookie: string,
  secret: string,
  nowMs: number,
): Promise<{ issuedAtMs: number } | null> {
  if (!cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return null;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = await hmac(secret, `admin:${body}`);
  if (!constantTimeStringEq(sig, expected)) return null;
  const issuedAtMs = Number(body);
  if (!Number.isFinite(issuedAtMs)) return null;
  if (issuedAtMs + ADMIN_SESSION_TTL_MS < nowMs) return null;
  return { issuedAtMs };
}

// ── Environment binding accessors ──────────────────────────────────────────

export function getAdminPassword(): string {
  const { env } = getCloudflareContext();
  const p = (env as unknown as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD;
  if (!p) throw new Error("ADMIN_PASSWORD not set");
  return p;
}

export function getAdminSessionSecret(): string {
  const { env } = getCloudflareContext();
  const s = (env as unknown as { ADMIN_SESSION_SECRET?: string }).ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET not set");
  return s;
}
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npx vitest run src/lib/admin-auth.test.ts`
Expected: PASS — all 9 assertions green.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin-auth.ts src/lib/admin-auth.test.ts
git commit -m "feat(admin): add HMAC-signed admin session cookie helpers"
```

---

## Task 5: Auth helper — `requireAdmin` and login/logout primitives

**Files:**
- Modify: `src/lib/admin-auth.ts`

- [ ] **Step 1: Append session management to `admin-auth.ts`**

Append to `src/lib/admin-auth.ts`:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const isProd = process.env.NODE_ENV === "production";

export async function issueAdminSessionCookie(nowMs: number = Date.now()): Promise<void> {
  const secret = getAdminSessionSecret();
  const value = await signAdminSession(nowMs, secret);
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/admin",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/admin",
    maxAge: 0,
  });
}

/**
 * Reads the admin_session cookie, verifies it, and either:
 *  - returns silently (request continues), refreshing the cookie if it's close to expiry, or
 *  - redirects to /admin/login.
 *
 * Throws via Next's `redirect()`, so the calling page returns no markup on failure.
 */
export async function requireAdmin(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) redirect("/admin/login");

  const secret = getAdminSessionSecret();
  const nowMs = Date.now();
  const result = await verifyAdminSession(raw, secret, nowMs);
  if (!result) redirect("/admin/login");

  // Sliding renewal: if less than 24h until expiry, re-issue.
  const remaining = result.issuedAtMs + ADMIN_SESSION_TTL_MS - nowMs;
  if (remaining < ADMIN_SESSION_REFRESH_THRESHOLD_MS) {
    await issueAdminSessionCookie(nowMs);
  }
}
```

- [ ] **Step 2: Verify the file type-checks**

Run: `npx tsc --noEmit -p tsconfig.json` (only fast option if available — otherwise `npm run build` later catches it).
Expected: no new errors from `admin-auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin-auth.ts
git commit -m "feat(admin): add requireAdmin + cookie issue/clear helpers"
```

---

## Task 6: Update middleware to bypass Clerk and block tenant /admin

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Replace middleware contents**

Replace `src/middleware.ts` with:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get("host") ?? "";
  const tenant = resolveTenant(host, ROOT);
  const url = req.nextUrl.clone();

  // Block /admin on tenant subdomains entirely — 404.
  if (tenant.kind === "tenant" && url.pathname.startsWith("/admin")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // On the apex, /admin handles its own auth (signed cookie). Skip Clerk for it.
  if (tenant.kind !== "tenant" && url.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (tenant.kind === "tenant") {
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next")) {
      return NextResponse.next();
    }
    url.pathname = `/sites/${tenant.subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)", "/(api|trpc)(.*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(admin): route /admin past Clerk and block on tenant hosts"
```

---

## Task 7: Admin queries — overview stats

**Files:**
- Create: `src/lib/db/queries/admin.ts`

- [ ] **Step 1: Implement `getOverviewStats`**

Create `src/lib/db/queries/admin.ts`:

```ts
import { sql, eq, and, gt, gte, desc, like, or, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

// Timestamps in this DB are stored as Date.now() milliseconds.
function daysAgoMs(n: number, nowMs: number = Date.now()): number {
  return nowMs - n * 86_400_000;
}

export type OverviewStats = {
  organizers: { total: number; new7d: number; new30d: number; active: number };
  events: {
    total: number;
    upcomingPublished: number;
    draft: number;
    published: number;
    archived: number;
  };
  participants: { totalActive: number; new7d: number; new30d: number };
  payments: {
    succeededAllCount: number;
    succeededAllSumCents: number;
    succeeded30dCount: number;
    succeeded30dSumCents: number;
    succeeded7dCount: number;
    succeeded7dSumCents: number;
    pendingCount: number;
    failedCount: number;
  };
};

export async function getOverviewStats(): Promise<OverviewStats> {
  const db = getDb();
  const nowMs = Date.now();
  const d7 = daysAgoMs(7, nowMs);
  const d30 = daysAgoMs(30, nowMs);

  const [
    orgTotal,
    orgNew7,
    orgNew30,
    orgActive,
    eventCounts,
    eventUpcoming,
    partTotal,
    partNew7,
    partNew30,
    paySucceededAll,
    paySucceeded30,
    paySucceeded7,
    payPending,
    payFailed,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(schema.organizers).get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.organizers)
      .where(gte(schema.organizers.createdAt, d7))
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.organizers)
      .where(gte(schema.organizers.createdAt, d30))
      .get(),
    db
      .select({ c: sql<number>`count(distinct ${schema.events.organizerId})` })
      .from(schema.events)
      .where(eq(schema.events.status, "published"))
      .get(),
    db
      .select({ status: schema.events.status, c: sql<number>`count(*)` })
      .from(schema.events)
      .groupBy(schema.events.status)
      .all(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.events)
      .where(and(eq(schema.events.status, "published"), gt(schema.events.startsAt, nowMs)))
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.participants)
      .where(eq(schema.participants.lifecycleStatus, "active"))
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.participants)
      .where(
        and(eq(schema.participants.lifecycleStatus, "active"), gte(schema.participants.createdAt, d7)),
      )
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.participants)
      .where(
        and(eq(schema.participants.lifecycleStatus, "active"), gte(schema.participants.createdAt, d30)),
      )
      .get(),
    db
      .select({
        c: sql<number>`count(*)`,
        s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)`,
      })
      .from(schema.payments)
      .where(eq(schema.payments.status, "succeeded"))
      .get(),
    db
      .select({
        c: sql<number>`count(*)`,
        s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)`,
      })
      .from(schema.payments)
      .where(
        and(eq(schema.payments.status, "succeeded"), gte(schema.payments.paidAt, d30)),
      )
      .get(),
    db
      .select({
        c: sql<number>`count(*)`,
        s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)`,
      })
      .from(schema.payments)
      .where(
        and(eq(schema.payments.status, "succeeded"), gte(schema.payments.paidAt, d7)),
      )
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.payments)
      .where(eq(schema.payments.status, "pending"))
      .get(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.payments)
      .where(eq(schema.payments.status, "failed"))
      .get(),
  ]);

  const eventByStatus = { draft: 0, published: 0, archived: 0 };
  let eventsTotal = 0;
  for (const row of eventCounts) {
    eventByStatus[row.status as "draft" | "published" | "archived"] = row.c;
    eventsTotal += row.c;
  }

  return {
    organizers: {
      total: orgTotal?.c ?? 0,
      new7d: orgNew7?.c ?? 0,
      new30d: orgNew30?.c ?? 0,
      active: orgActive?.c ?? 0,
    },
    events: {
      total: eventsTotal,
      upcomingPublished: eventUpcoming?.c ?? 0,
      draft: eventByStatus.draft,
      published: eventByStatus.published,
      archived: eventByStatus.archived,
    },
    participants: {
      totalActive: partTotal?.c ?? 0,
      new7d: partNew7?.c ?? 0,
      new30d: partNew30?.c ?? 0,
    },
    payments: {
      succeededAllCount: paySucceededAll?.c ?? 0,
      succeededAllSumCents: paySucceededAll?.s ?? 0,
      succeeded30dCount: paySucceeded30?.c ?? 0,
      succeeded30dSumCents: paySucceeded30?.s ?? 0,
      succeeded7dCount: paySucceeded7?.c ?? 0,
      succeeded7dSumCents: paySucceeded7?.s ?? 0,
      pendingCount: payPending?.c ?? 0,
      failedCount: payFailed?.c ?? 0,
    },
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in this file. (If `like` or `or` are flagged as unused, leave them — Task 8 uses them.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries/admin.ts
git commit -m "feat(admin): add platform-wide overview stats query"
```

---

## Task 8: Admin queries — recent lists and organizer list with aggregates

**Files:**
- Modify: `src/lib/db/queries/admin.ts`

- [ ] **Step 1: Append `getRecentOrganizers`, `getRecentSucceededPayments`, `listOrganizers`**

Append to `src/lib/db/queries/admin.ts`:

```ts
export type RecentOrganizer = {
  id: string;
  displayName: string;
  subdomain: string;
  contactEmail: string | null;
  createdAt: number;
  stripeOnboardingComplete: boolean;
};

export async function getRecentOrganizers(limit = 10): Promise<RecentOrganizer[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.organizers.id,
      displayName: schema.organizers.displayName,
      subdomain: schema.organizers.subdomain,
      contactEmail: schema.organizers.contactEmail,
      createdAt: schema.organizers.createdAt,
      stripeOnboardingComplete: schema.organizers.stripeOnboardingComplete,
    })
    .from(schema.organizers)
    .orderBy(desc(schema.organizers.createdAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({ ...r, stripeOnboardingComplete: r.stripeOnboardingComplete === 1 }));
}

export type RecentPayment = {
  paymentId: string;
  amountCents: number;
  currency: string;
  paidAt: number;
  organizerId: string;
  organizerDisplayName: string;
  eventId: string;
  eventTitle: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
};

export async function getRecentSucceededPayments(limit = 10): Promise<RecentPayment[]> {
  const db = getDb();
  const rows = await db
    .select({
      paymentId: schema.payments.id,
      amountCents: schema.payments.amountCents,
      currency: schema.payments.currency,
      paidAt: schema.payments.paidAt,
      participantId: schema.participants.id,
      firstName: schema.participants.firstName,
      lastName: schema.participants.lastName,
      participantEmail: schema.participants.email,
      eventId: schema.events.id,
      eventTitle: schema.events.title,
      organizerId: schema.organizers.id,
      organizerDisplayName: schema.organizers.displayName,
    })
    .from(schema.payments)
    .innerJoin(schema.participants, eq(schema.payments.participantId, schema.participants.id))
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(eq(schema.payments.status, "succeeded"))
    .orderBy(desc(schema.payments.paidAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({
    paymentId: r.paymentId,
    amountCents: r.amountCents,
    currency: r.currency,
    paidAt: r.paidAt ?? 0,
    organizerId: r.organizerId,
    organizerDisplayName: r.organizerDisplayName,
    eventId: r.eventId,
    eventTitle: r.eventTitle,
    participantId: r.participantId,
    participantName: `${r.firstName} ${r.lastName}`.trim(),
    participantEmail: r.participantEmail,
  }));
}

export type OrganizerListRow = {
  id: string;
  displayName: string;
  subdomain: string;
  contactEmail: string | null;
  eventCount: number;
  participantCount: number;
  revenueCents: number;
  stripeOnboardingComplete: boolean;
  createdAt: number;
};

export type OrganizerListSort = "displayName" | "events" | "participants" | "revenue" | "created";
export type SortDir = "asc" | "desc";

export async function listOrganizers(params: {
  q?: string;
  page: number;
  pageSize: number;
  sort?: OrganizerListSort;
  dir?: SortDir;
}): Promise<{ rows: OrganizerListRow[]; totalCount: number }> {
  const db = getDb();
  const sort: OrganizerListSort = params.sort ?? "created";
  const dir: SortDir = params.dir ?? "desc";
  const offset = Math.max(0, (params.page - 1) * params.pageSize);

  const qPattern = params.q ? `%${params.q.toLowerCase()}%` : null;
  const whereExpr = qPattern
    ? or(
        like(sql`lower(${schema.organizers.displayName})`, qPattern),
        like(sql`lower(${schema.organizers.subdomain})`, qPattern),
        like(sql`lower(${schema.organizers.contactEmail})`, qPattern),
      )
    : undefined;

  const totalRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.organizers)
    .where(whereExpr)
    .get();
  const totalCount = totalRow?.c ?? 0;

  // Per-organizer aggregates via correlated subqueries.
  const eventCountSql = sql<number>`(
    select count(*) from ${schema.events} where ${schema.events.organizerId} = ${schema.organizers.id}
  )`;
  const participantCountSql = sql<number>`(
    select count(*) from ${schema.participants}
    inner join ${schema.events} on ${schema.participants.eventId} = ${schema.events.id}
    where ${schema.events.organizerId} = ${schema.organizers.id}
      and ${schema.participants.lifecycleStatus} = 'active'
  )`;
  const revenueSql = sql<number>`(
    select coalesce(sum(${schema.payments.amountCents}), 0) from ${schema.payments}
    inner join ${schema.participants} on ${schema.payments.participantId} = ${schema.participants.id}
    inner join ${schema.events} on ${schema.participants.eventId} = ${schema.events.id}
    where ${schema.events.organizerId} = ${schema.organizers.id}
      and ${schema.payments.status} = 'succeeded'
  )`;

  const orderExpr = (() => {
    const a = dir === "asc";
    switch (sort) {
      case "displayName":
        return a ? sql`${schema.organizers.displayName} asc` : sql`${schema.organizers.displayName} desc`;
      case "events":
        return a ? sql`event_count asc` : sql`event_count desc`;
      case "participants":
        return a ? sql`participant_count asc` : sql`participant_count desc`;
      case "revenue":
        return a ? sql`revenue_cents asc` : sql`revenue_cents desc`;
      case "created":
      default:
        return a ? sql`${schema.organizers.createdAt} asc` : sql`${schema.organizers.createdAt} desc`;
    }
  })();

  const rows = await db
    .select({
      id: schema.organizers.id,
      displayName: schema.organizers.displayName,
      subdomain: schema.organizers.subdomain,
      contactEmail: schema.organizers.contactEmail,
      stripeOnboardingComplete: schema.organizers.stripeOnboardingComplete,
      createdAt: schema.organizers.createdAt,
      event_count: eventCountSql.as("event_count"),
      participant_count: participantCountSql.as("participant_count"),
      revenue_cents: revenueSql.as("revenue_cents"),
    })
    .from(schema.organizers)
    .where(whereExpr)
    .orderBy(orderExpr)
    .limit(params.pageSize)
    .offset(offset)
    .all();

  return {
    totalCount,
    rows: rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      subdomain: r.subdomain,
      contactEmail: r.contactEmail,
      eventCount: Number(r.event_count) || 0,
      participantCount: Number(r.participant_count) || 0,
      revenueCents: Number(r.revenue_cents) || 0,
      stripeOnboardingComplete: r.stripeOnboardingComplete === 1,
      createdAt: r.createdAt,
    })),
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries/admin.ts
git commit -m "feat(admin): add recent lists and paginated organizer list query"
```

---

## Task 9: Admin queries — organizer detail

**Files:**
- Modify: `src/lib/db/queries/admin.ts`

- [ ] **Step 1: Append `getOrganizerDetail`**

Append to `src/lib/db/queries/admin.ts`:

```ts
import type { Organizer } from "@/lib/db/schema";

export type OrganizerEventRow = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  startsAt: number;
  endsAt: number;
  capacity: number;
  registeredCount: number;
  revenueCents: number;
  createdAt: number;
};

export type OrganizerDetail = {
  organizer: Organizer;
  stats: {
    eventsByStatus: { draft: number; published: number; archived: number };
    activeParticipants: number;
    revenueCents: number;
  };
  events: OrganizerEventRow[];
};

export async function getOrganizerDetail(organizerId: string): Promise<OrganizerDetail | null> {
  const db = getDb();

  const organizer = await db
    .select()
    .from(schema.organizers)
    .where(eq(schema.organizers.id, organizerId))
    .get();
  if (!organizer) return null;

  const [eventStatusRows, activeParticipantsRow, revenueRow, eventRows] = await Promise.all([
    db
      .select({ status: schema.events.status, c: sql<number>`count(*)` })
      .from(schema.events)
      .where(eq(schema.events.organizerId, organizerId))
      .groupBy(schema.events.status)
      .all(),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.participants)
      .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
      .where(
        and(
          eq(schema.events.organizerId, organizerId),
          eq(schema.participants.lifecycleStatus, "active"),
        ),
      )
      .get(),
    db
      .select({ s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)` })
      .from(schema.payments)
      .innerJoin(schema.participants, eq(schema.payments.participantId, schema.participants.id))
      .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
      .where(
        and(eq(schema.events.organizerId, organizerId), eq(schema.payments.status, "succeeded")),
      )
      .get(),
    db
      .select({
        id: schema.events.id,
        title: schema.events.title,
        slug: schema.events.slug,
        status: schema.events.status,
        startsAt: schema.events.startsAt,
        endsAt: schema.events.endsAt,
        capacity: schema.events.capacity,
        createdAt: schema.events.createdAt,
        registered: sql<number>`(
          select count(*) from ${schema.participants}
          where ${schema.participants.eventId} = ${schema.events.id}
            and ${schema.participants.lifecycleStatus} = 'active'
        )`.as("registered"),
        revenue: sql<number>`(
          select coalesce(sum(${schema.payments.amountCents}), 0) from ${schema.payments}
          inner join ${schema.participants} on ${schema.payments.participantId} = ${schema.participants.id}
          where ${schema.participants.eventId} = ${schema.events.id}
            and ${schema.payments.status} = 'succeeded'
        )`.as("revenue"),
      })
      .from(schema.events)
      .where(eq(schema.events.organizerId, organizerId))
      .orderBy(desc(schema.events.startsAt))
      .all(),
  ]);

  const eventsByStatus = { draft: 0, published: 0, archived: 0 };
  for (const r of eventStatusRows) {
    eventsByStatus[r.status as "draft" | "published" | "archived"] = r.c;
  }

  return {
    organizer,
    stats: {
      eventsByStatus,
      activeParticipants: activeParticipantsRow?.c ?? 0,
      revenueCents: revenueRow?.s ?? 0,
    },
    events: eventRows.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      status: e.status,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      capacity: e.capacity,
      registeredCount: Number(e.registered) || 0,
      revenueCents: Number(e.revenue) || 0,
      createdAt: e.createdAt,
    })),
  };
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/db/queries/admin.ts
git commit -m "feat(admin): add organizer detail query with aggregates"
```

---

## Task 10: Admin queries — event detail (with participants & payments)

**Files:**
- Modify: `src/lib/db/queries/admin.ts`

- [ ] **Step 1: Append `getEventDetail`**

Append to `src/lib/db/queries/admin.ts`:

```ts
import type { Event as EventRow, Payment, Attendee } from "@/lib/db/schema";

export type EventDetailParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  lifecycleStatus: "active" | "waitlisted" | "cancelled";
  createdAt: number;
  activeAttendeeCount: number;
  paidCents: number;
  outstandingCents: number;
  attendees: Attendee[];
  payments: Payment[];
};

export type EventDetail = {
  event: EventRow;
  organizer: { id: string; displayName: string; subdomain: string };
  aggregates: {
    registered: number;
    waitlisted: number;
    cancelled: number;
    activeAttendees: number;
    succeededSumCents: number;
    pendingSumCents: number;
    refundedSumCents: number;
  };
  participants: EventDetailParticipant[];
  payments: Array<Payment & { participantName: string; participantEmail: string }>;
};

export async function getEventDetail(eventId: string): Promise<EventDetail | null> {
  const db = getDb();

  const event = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .get();
  if (!event) return null;

  const organizer = await db
    .select({
      id: schema.organizers.id,
      displayName: schema.organizers.displayName,
      subdomain: schema.organizers.subdomain,
    })
    .from(schema.organizers)
    .where(eq(schema.organizers.id, event.organizerId))
    .get();
  if (!organizer) return null;

  const participants = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.eventId, eventId))
    .orderBy(desc(schema.participants.createdAt))
    .all();

  const participantIds = participants.map((p) => p.id);

  const [attendees, payments] = await Promise.all([
    participantIds.length > 0
      ? db
          .select()
          .from(schema.attendees)
          .where(inArray(schema.attendees.participantId, participantIds))
          .all()
      : Promise.resolve([] as Attendee[]),
    participantIds.length > 0
      ? db
          .select()
          .from(schema.payments)
          .where(inArray(schema.payments.participantId, participantIds))
          .orderBy(desc(schema.payments.createdAt))
          .all()
      : Promise.resolve([] as Payment[]),
  ]);

  const attendeesByParticipant = new Map<string, Attendee[]>();
  for (const a of attendees) {
    const list = attendeesByParticipant.get(a.participantId) ?? [];
    list.push(a);
    attendeesByParticipant.set(a.participantId, list);
  }
  const paymentsByParticipant = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = paymentsByParticipant.get(p.participantId) ?? [];
    list.push(p);
    paymentsByParticipant.set(p.participantId, list);
  }

  const participantsOut: EventDetailParticipant[] = participants.map((p) => {
    const pAtt = attendeesByParticipant.get(p.id) ?? [];
    const pPay = paymentsByParticipant.get(p.id) ?? [];
    const paidCents = pPay
      .filter((x) => x.status === "succeeded")
      .reduce((s, x) => s + x.amountCents, 0);
    const outstandingCents = pPay
      .filter((x) => x.status === "pending")
      .reduce((s, x) => s + x.amountCents, 0);
    const activeAttendeeCount = pAtt.filter((a) => a.cancelledAt == null).length;
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      lifecycleStatus: p.lifecycleStatus,
      createdAt: p.createdAt,
      activeAttendeeCount,
      paidCents,
      outstandingCents,
      attendees: pAtt,
      payments: pPay,
    };
  });

  const aggregates = {
    registered: participantsOut.filter((p) => p.lifecycleStatus === "active").length,
    waitlisted: participantsOut.filter((p) => p.lifecycleStatus === "waitlisted").length,
    cancelled: participantsOut.filter((p) => p.lifecycleStatus === "cancelled").length,
    activeAttendees: participantsOut.reduce((s, p) => s + p.activeAttendeeCount, 0),
    succeededSumCents: payments
      .filter((x) => x.status === "succeeded")
      .reduce((s, x) => s + x.amountCents, 0),
    pendingSumCents: payments
      .filter((x) => x.status === "pending")
      .reduce((s, x) => s + x.amountCents, 0),
    refundedSumCents: payments
      .filter((x) => x.status === "refunded")
      .reduce((s, x) => s + x.amountCents, 0),
  };

  const participantById = new Map(participants.map((p) => [p.id, p]));
  const paymentsOut = payments.map((pay) => {
    const p = participantById.get(pay.participantId);
    return {
      ...pay,
      participantName: p ? `${p.firstName} ${p.lastName}`.trim() : pay.participantId,
      participantEmail: p?.email ?? "",
    };
  });

  return { event, organizer, aggregates, participants: participantsOut, payments: paymentsOut };
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/db/queries/admin.ts
git commit -m "feat(admin): add event detail query with participants and payments"
```

---

## Task 11: Admin layout and top bar

**Files:**
- Create: `src/components/admin/AdminTopBar.tsx`
- Create: `src/app/admin/layout.tsx`

- [ ] **Step 1: Build the top bar component**

Create `src/components/admin/AdminTopBar.tsx`:

```tsx
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
```

- [ ] **Step 2: Build the admin layout**

Create `src/app/admin/layout.tsx`:

```tsx
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Auth is enforced per-page (so the /admin/login route can opt out).
  // Layout renders no chrome on its own; child pages render their own AdminTopBar.
  return <div className="min-h-screen bg-muted/30">{children}</div>;
}
```

> Auth is intentionally per-page rather than in the layout: Next 16 evaluates layouts above their children, so calling `requireAdmin()` in this layout would redirect even the login page. Each page calls `requireAdmin()` itself, except `/admin/login/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminTopBar.tsx src/app/admin/layout.tsx
git commit -m "feat(admin): add admin layout shell and top bar"
```

---

## Task 12: Login page + login/logout server actions

**Files:**
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/login/actions.ts`
- Create: `src/app/admin/login/logout/route.ts`

- [ ] **Step 1: Build the login server action**

Create `src/app/admin/login/actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  constantTimeStringEq,
  getAdminPassword,
  issueAdminSessionCookie,
} from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function loginAction(formData: FormData): Promise<{ error?: string } | void> {
  const h = await headers();
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (!checkRateLimit(`admin-login:${ip}`)) {
    return { error: "Nieprawidłowe hasło lub zbyt wiele prób." };
  }

  const submitted = String(formData.get("password") ?? "");
  let expected: string;
  try {
    expected = getAdminPassword();
  } catch {
    return { error: "Panel nie jest skonfigurowany." };
  }

  if (!constantTimeStringEq(submitted, expected)) {
    return { error: "Nieprawidłowe hasło lub zbyt wiele prób." };
  }

  await issueAdminSessionCookie();
  redirect("/admin");
}
```

- [ ] **Step 2: Build the login page**

The page reads `?e=` from search params to show an error flash after a failed login. It defines an inline wrapper server action that calls `loginAction`, and on error redirects back to itself with the error in the URL. Create `src/app/admin/login/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { loginAction } from "./actions";

export const metadata = { title: "Wyjazdo Admin" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const sp = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const result = await loginAction(formData);
    if (result?.error) {
      const params = new URLSearchParams({ e: result.error });
      redirect(`/admin/login?${params.toString()}`);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <form
        action={action}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-primary">Wyjazdo Admin</h1>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Hasło</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        {sp.e ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {sp.e}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 font-medium text-white hover:opacity-90"
        >
          Zaloguj
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Build the logout route handler**

Create `src/app/admin/login/logout/route.ts`. `NextResponse.redirect` needs an absolute URL, so we build it from the request headers:

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-auth";

export async function POST() {
  await clearAdminSessionCookie();
  const h = await headers();
  const host = h.get("host") ?? "localhost";
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  return NextResponse.redirect(`${proto}//${host}/admin/login`, { status: 303 });
}
```

- [ ] **Step 4: Type-check and try the dev server**

Run: `npx tsc --noEmit`
Expected: no errors.

Run (in another shell): `npm run dev`, then visit `http://localhost:3000/admin/login`.
Expected: form renders. Submitting it will fail until `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are configured in `.dev.vars` (next task).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/login
git commit -m "feat(admin): add login page + login/logout server actions"
```

---

## Task 13: Configure local secrets

**Files:**
- Modify: `.dev.vars` (or create if missing — gitignored)

- [ ] **Step 1: Check for existing `.dev.vars`**

Run: `ls -la /home/stas/Desktop/wyjazdo/.dev.vars 2>/dev/null || echo "missing"`

If missing, ask the user before creating it: `.dev.vars` typically lives at the project root and holds local secrets. Confirm with the user, then create it.

- [ ] **Step 2: Add admin secrets to `.dev.vars`**

Append (or add) to `.dev.vars`:

```
ADMIN_PASSWORD=change-me-locally
ADMIN_SESSION_SECRET=local-dev-secret-please-rotate-1234567890abcdef
```

Do NOT commit `.dev.vars`. Verify it's listed in `.gitignore`:

```bash
grep -q "^.dev.vars" .gitignore || echo ".dev.vars" >> .gitignore
```

- [ ] **Step 3: Smoke test login**

Run: `npm run dev`
Visit `http://localhost:3000/admin/login`, submit `change-me-locally`.
Expected: redirected to `/admin` (which currently doesn't exist — should 404 from Next, NOT redirect back to login).

- [ ] **Step 4: No commit** (`.dev.vars` is gitignored; no other code changes here.)

---

## Task 14: Overview page widgets — RecentOrganizersList, RecentPaymentsList

**Files:**
- Create: `src/components/admin/RecentOrganizersList.tsx`
- Create: `src/components/admin/RecentPaymentsList.tsx`

- [ ] **Step 1: Build the recent-organizers widget**

Create `src/components/admin/RecentOrganizersList.tsx`:

```tsx
import Link from "next/link";
import type { RecentOrganizer } from "@/lib/db/queries/admin";

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function RecentOrganizersList({ rows }: { rows: RecentOrganizer[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak organizatorów.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-background">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between p-3 text-sm">
          <div className="min-w-0">
            <Link
              href={`/admin/organizers/${r.id}`}
              className="font-medium text-primary hover:underline"
            >
              {r.displayName}
            </Link>
            <div className="text-xs text-muted-foreground">
              <a
                href={`https://${r.subdomain}.${rootDomain}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {r.subdomain}.{rootDomain}
              </a>
              {r.contactEmail ? ` · ${r.contactEmail}` : null}
            </div>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span>{r.stripeOnboardingComplete ? "Stripe ✓" : "Stripe ✗"}</span>
            <span>{formatDate(r.createdAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Build the recent-payments widget**

Create `src/components/admin/RecentPaymentsList.tsx`:

```tsx
import Link from "next/link";
import { formatPlnFromCents } from "@/lib/format-currency";
import type { RecentPayment } from "@/lib/db/queries/admin";

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentPaymentsList({ rows }: { rows: RecentPayment[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak płatności.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-background">
      {rows.map((r) => (
        <li key={r.paymentId} className="grid grid-cols-[1fr_auto] gap-2 p-3 text-sm">
          <div className="min-w-0">
            <div className="font-medium tabular-nums text-primary">
              {formatPlnFromCents(r.amountCents)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              <Link
                href={`/admin/organizers/${r.organizerId}`}
                className="hover:underline"
              >
                {r.organizerDisplayName}
              </Link>{" "}
              ·{" "}
              <Link
                href={`/admin/organizers/${r.organizerId}/events/${r.eventId}`}
                className="hover:underline"
              >
                {r.eventTitle}
              </Link>{" "}
              · {r.participantName} ({r.participantEmail})
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {r.paidAt ? formatDateTime(r.paidAt) : "—"}
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/RecentOrganizersList.tsx src/components/admin/RecentPaymentsList.tsx
git commit -m "feat(admin): add recent-organizers and recent-payments widgets"
```

---

## Task 15: Overview page

**Files:**
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Build the overview page**

Create `src/app/admin/page.tsx`:

```tsx
import { requireAdmin } from "@/lib/admin-auth";
import {
  getOverviewStats,
  getRecentOrganizers,
  getRecentSucceededPayments,
} from "@/lib/db/queries/admin";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentOrganizersList } from "@/components/admin/RecentOrganizersList";
import { RecentPaymentsList } from "@/components/admin/RecentPaymentsList";
import { formatPlnFromCents } from "@/lib/format-currency";

export const metadata = { title: "Przegląd · Wyjazdo Admin" };

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [stats, recentOrgs, recentPays] = await Promise.all([
    getOverviewStats(),
    getRecentOrganizers(10),
    getRecentSucceededPayments(10),
  ]);

  return (
    <>
      <AdminTopBar crumbs={[{ label: "Przegląd" }]} />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Organizatorzy
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Wszyscy">{stats.organizers.total}</StatCard>
            <StatCard label="Nowi (7 dni)">{stats.organizers.new7d}</StatCard>
            <StatCard label="Nowi (30 dni)">{stats.organizers.new30d}</StatCard>
            <StatCard label="Aktywni" subtitle="z opublikowanym wydarzeniem">
              {stats.organizers.active}
            </StatCard>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Wydarzenia
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Wszystkie">{stats.events.total}</StatCard>
            <StatCard label="Nadchodzące" subtitle="opublikowane">
              {stats.events.upcomingPublished}
            </StatCard>
            <StatCard label="Szkice">{stats.events.draft}</StatCard>
            <StatCard label="Opublikowane">{stats.events.published}</StatCard>
            <StatCard label="Zarchiwizowane">{stats.events.archived}</StatCard>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Uczestnicy
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Aktywni razem">{stats.participants.totalActive}</StatCard>
            <StatCard label="Nowi (7 dni)">{stats.participants.new7d}</StatCard>
            <StatCard label="Nowi (30 dni)">{stats.participants.new30d}</StatCard>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Płatności
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Opłacone razem"
              subtitle={`${stats.payments.succeededAllCount} szt.`}
              variant="navy"
            >
              {formatPlnFromCents(stats.payments.succeededAllSumCents)}
            </StatCard>
            <StatCard
              label="Opłacone (30 dni)"
              subtitle={`${stats.payments.succeeded30dCount} szt.`}
            >
              {formatPlnFromCents(stats.payments.succeeded30dSumCents)}
            </StatCard>
            <StatCard
              label="Opłacone (7 dni)"
              subtitle={`${stats.payments.succeeded7dCount} szt.`}
            >
              {formatPlnFromCents(stats.payments.succeeded7dSumCents)}
            </StatCard>
            <StatCard label="Oczekujące">{stats.payments.pendingCount}</StatCard>
            <StatCard label="Nieudane">{stats.payments.failedCount}</StatCard>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ostatni organizatorzy
            </h2>
            <RecentOrganizersList rows={recentOrgs} />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ostatnie wpłaty
            </h2>
            <RecentPaymentsList rows={recentPays} />
          </section>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev`
Visit `http://localhost:3000/admin` (log in first if needed).
Expected: page renders with stat cards and lists. Numbers may be zero on a fresh local DB.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): add overview page with stats and recent lists"
```

---

## Task 16: Shared admin table components

**Files:**
- Create: `src/components/admin/AdminTable.tsx`
- Create: `src/components/admin/AdminSortHeader.tsx`
- Create: `src/components/admin/AdminPagination.tsx`
- Create: `src/components/admin/AdminSearchForm.tsx`

- [ ] **Step 1: Build `AdminTable`**

Create `src/components/admin/AdminTable.tsx`:

```tsx
import type { ReactNode } from "react";

export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function AdminThead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </thead>
  );
}

export function AdminTh({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-3 py-2 ${className}`}>{children}</th>;
}

export function AdminTbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function AdminTr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`hover:bg-muted/30 ${className}`}>{children}</tr>;
}

export function AdminTd({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
```

- [ ] **Step 2: Build `AdminSortHeader`**

Create `src/components/admin/AdminSortHeader.tsx`:

```tsx
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
```

- [ ] **Step 3: Build `AdminPagination`**

Create `src/components/admin/AdminPagination.tsx`:

```tsx
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
```

- [ ] **Step 4: Build `AdminSearchForm`**

Create `src/components/admin/AdminSearchForm.tsx`:

```tsx
export function AdminSearchForm({
  action,
  defaultValue = "",
  placeholder = "Szukaj…",
}: {
  action: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <form action={action} method="get" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
      <button
        type="submit"
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Szukaj
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminTable.tsx src/components/admin/AdminSortHeader.tsx src/components/admin/AdminPagination.tsx src/components/admin/AdminSearchForm.tsx
git commit -m "feat(admin): add shared table, sort header, pagination, search components"
```

---

## Task 17: Organizers list page

**Files:**
- Create: `src/app/admin/organizers/page.tsx`

- [ ] **Step 1: Build the organizers list page**

Create `src/app/admin/organizers/page.tsx`:

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import {
  listOrganizers,
  type OrganizerListSort,
  type SortDir,
} from "@/lib/db/queries/admin";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  AdminTable,
  AdminThead,
  AdminTh,
  AdminTbody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";
import { AdminSortHeader } from "@/components/admin/AdminSortHeader";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchForm } from "@/components/admin/AdminSearchForm";
import { formatPlnFromCents } from "@/lib/format-currency";

const PAGE_SIZE = 50;
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";

export const metadata = { title: "Organizatorzy · Wyjazdo Admin" };

function parseSort(s: string | undefined): OrganizerListSort {
  switch (s) {
    case "displayName":
    case "events":
    case "participants":
    case "revenue":
    case "created":
      return s;
    default:
      return "created";
  }
}
function parseDir(d: string | undefined): SortDir {
  return d === "asc" ? "asc" : "desc";
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function OrganizersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = parseSort(sp.sort);
  const dir = parseDir(sp.dir);

  const { rows, totalCount } = await listOrganizers({
    q,
    page,
    pageSize: PAGE_SIZE,
    sort,
    dir,
  });

  const baseQuery = new URLSearchParams();
  if (q) baseQuery.set("q", q);
  baseQuery.set("sort", sort);
  baseQuery.set("dir", dir);

  const buildSortHref = (newSort: string, newDir: SortDir) => {
    const p = new URLSearchParams(baseQuery);
    p.set("sort", newSort);
    p.set("dir", newDir);
    p.delete("page");
    return `/admin/organizers?${p.toString()}`;
  };
  const buildPageHref = (newPage: number) => {
    const p = new URLSearchParams(baseQuery);
    p.set("page", String(newPage));
    return `/admin/organizers?${p.toString()}`;
  };

  return (
    <>
      <AdminTopBar crumbs={[{ label: "Organizatorzy" }]} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <AdminSearchForm action="/admin/organizers" defaultValue={q ?? ""} />

        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>
                <AdminSortHeader
                  label="Organizator"
                  field="displayName"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
              <AdminTh>Subdomena</AdminTh>
              <AdminTh>Email</AdminTh>
              <AdminTh className="text-right">
                <AdminSortHeader
                  label="Wydarzenia"
                  field="events"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
              <AdminTh className="text-right">
                <AdminSortHeader
                  label="Uczestnicy"
                  field="participants"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
              <AdminTh className="text-right">
                <AdminSortHeader
                  label="Przychód"
                  field="revenue"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
              <AdminTh>Stripe</AdminTh>
              <AdminTh>
                <AdminSortHeader
                  label="Utworzony"
                  field="created"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
            </tr>
          </AdminThead>
          <AdminTbody>
            {rows.length === 0 ? (
              <AdminTr>
                <AdminTd className="py-4 text-center text-muted-foreground">
                  Brak wyników.
                </AdminTd>
              </AdminTr>
            ) : (
              rows.map((r) => (
                <AdminTr key={r.id}>
                  <AdminTd>
                    <Link
                      href={`/admin/organizers/${r.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.displayName}
                    </Link>
                  </AdminTd>
                  <AdminTd>
                    <a
                      href={`https://${r.subdomain}.${rootDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {r.subdomain}
                    </a>
                  </AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">
                    {r.contactEmail ?? "—"}
                  </AdminTd>
                  <AdminTd className="text-right tabular-nums">{r.eventCount}</AdminTd>
                  <AdminTd className="text-right tabular-nums">{r.participantCount}</AdminTd>
                  <AdminTd className="text-right tabular-nums">
                    {formatPlnFromCents(r.revenueCents)}
                  </AdminTd>
                  <AdminTd>{r.stripeOnboardingComplete ? "✓" : "✗"}</AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </AdminTd>
                </AdminTr>
              ))
            )}
          </AdminTbody>
        </AdminTable>

        <AdminPagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          buildHref={buildPageHref}
        />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Smoke test**

Visit `http://localhost:3000/admin/organizers` in dev.
Expected: table renders. Search and sort links work (URL changes; results reorder).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/organizers/page.tsx
git commit -m "feat(admin): add organizers list page with search, sort, pagination"
```

---

## Task 18: Organizer detail page

**Files:**
- Create: `src/app/admin/organizers/[organizerId]/page.tsx`

- [ ] **Step 1: Build the organizer detail page**

Create `src/app/admin/organizers/[organizerId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrganizerDetail } from "@/lib/db/queries/admin";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  AdminTable,
  AdminThead,
  AdminTh,
  AdminTbody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatPlnFromCents } from "@/lib/format-currency";

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
function formatDateTime(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OrganizerDetailPage({
  params,
}: {
  params: Promise<{ organizerId: string }>;
}) {
  await requireAdmin();
  const { organizerId } = await params;
  const detail = await getOrganizerDetail(organizerId);
  if (!detail) notFound();

  const o = detail.organizer;
  const socialLinks: Record<string, string> = o.socialLinks
    ? safeParseJsonRecord(o.socialLinks)
    : {};

  return (
    <>
      <AdminTopBar
        crumbs={[
          { label: "Organizatorzy", href: "/admin/organizers" },
          { label: o.displayName },
        ]}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="grid gap-6 rounded-xl border border-border bg-background p-5 md:grid-cols-[120px_1fr]">
          <div className="flex flex-col items-start gap-2">
            {o.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.logoUrl}
                alt={o.displayName}
                className="h-24 w-24 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-border text-3xl font-bold text-muted-foreground">
                {o.displayName.charAt(0)}
              </div>
            )}
            {o.brandColor ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="inline-block h-4 w-4 rounded border border-border"
                  style={{ backgroundColor: o.brandColor }}
                />
                {o.brandColor}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-primary">{o.displayName}</h1>
            {o.description ? (
              <p className="text-sm text-muted-foreground">{o.description}</p>
            ) : null}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <Detail label="Subdomena">
                <a
                  href={`https://${o.subdomain}.${rootDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {o.subdomain}.{rootDomain}
                </a>
              </Detail>
              <Detail label="Email">{o.contactEmail ?? "—"}</Detail>
              <Detail label="Telefon">{o.contactPhone ?? "—"}</Detail>
              <Detail label="Utworzony">{formatDateTime(o.createdAt)}</Detail>
              <Detail label="Zaktualizowany">{formatDateTime(o.updatedAt)}</Detail>
              <Detail label="Regulamin zaakceptowany">
                {formatDateTime(o.termsAcceptedAt)}
              </Detail>
              <Detail label="DPA zaakceptowana">{formatDateTime(o.dpaAcceptedAt)}</Detail>
              <Detail label="Stripe account">{o.stripeAccountId ?? "—"}</Detail>
              <Detail label="Stripe onboarding">
                {o.stripeOnboardingComplete ? "✓ Zakończony" : "✗ Niezakończony"}
              </Detail>
              <Detail label="Stripe payouts">
                {o.stripePayoutsEnabled ? "✓ Włączone" : "✗ Wyłączone"}
              </Detail>
              <Detail label="Stripe ostatnia synchronizacja">
                {formatDateTime(o.stripeAccountSyncedAt)}
              </Detail>
            </dl>
            {Object.keys(socialLinks).length > 0 ? (
              <div className="pt-2 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Social
                </div>
                <ul className="mt-1 flex flex-wrap gap-3">
                  {Object.entries(socialLinks).map(([k, v]) => (
                    <li key={k}>
                      <a
                        href={v}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {k}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Podsumowanie
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Aktywni uczestnicy">{detail.stats.activeParticipants}</StatCard>
            <StatCard label="Przychód">
              {formatPlnFromCents(detail.stats.revenueCents)}
            </StatCard>
            <StatCard label="Szkice">{detail.stats.eventsByStatus.draft}</StatCard>
            <StatCard label="Opublikowane">{detail.stats.eventsByStatus.published}</StatCard>
            <StatCard label="Zarchiwizowane">{detail.stats.eventsByStatus.archived}</StatCard>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Wydarzenia ({detail.events.length})
          </h2>
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>Tytuł</AdminTh>
                <AdminTh>Start</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh className="text-right">Pojemność</AdminTh>
                <AdminTh className="text-right">Zapisani</AdminTh>
                <AdminTh className="text-right">Przychód</AdminTh>
                <AdminTh>Utworzone</AdminTh>
              </tr>
            </AdminThead>
            <AdminTbody>
              {detail.events.length === 0 ? (
                <AdminTr>
                  <AdminTd className="py-4 text-center text-muted-foreground">
                    Brak wydarzeń.
                  </AdminTd>
                </AdminTr>
              ) : (
                detail.events.map((e) => (
                  <AdminTr key={e.id}>
                    <AdminTd>
                      <Link
                        href={`/admin/organizers/${organizerId}/events/${e.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {e.title}
                      </Link>
                    </AdminTd>
                    <AdminTd className="text-xs text-muted-foreground">
                      {formatDate(e.startsAt)}
                    </AdminTd>
                    <AdminTd className="text-xs">{e.status}</AdminTd>
                    <AdminTd className="text-right tabular-nums">{e.capacity}</AdminTd>
                    <AdminTd className="text-right tabular-nums">
                      {e.registeredCount}
                    </AdminTd>
                    <AdminTd className="text-right tabular-nums">
                      {formatPlnFromCents(e.revenueCents)}
                    </AdminTd>
                    <AdminTd className="text-xs text-muted-foreground">
                      {formatDate(e.createdAt)}
                    </AdminTd>
                  </AdminTr>
                ))
              )}
            </AdminTbody>
          </AdminTable>
        </section>
      </main>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </>
  );
}

function safeParseJsonRecord(s: string): Record<string, string> {
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {}
  return {};
}
```

- [ ] **Step 2: Smoke test**

Click an organizer in `/admin/organizers`. Expected: detail page renders with profile + events.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/organizers/[organizerId]/page.tsx
git commit -m "feat(admin): add organizer detail page"
```

---

## Task 19: Participant expandable row component

**Files:**
- Create: `src/components/admin/AdminParticipantRow.tsx`

- [ ] **Step 1: Build the expandable row using `<details>`**

Create `src/components/admin/AdminParticipantRow.tsx`:

```tsx
import { formatPlnFromCents } from "@/lib/format-currency";
import type { EventDetailParticipant } from "@/lib/db/queries/admin";

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function AdminParticipantRow({ p }: { p: EventDetailParticipant }) {
  return (
    <details className="border-b border-border last:border-b-0">
      <summary className="grid cursor-pointer grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30">
        <span>
          <span className="font-medium">
            {p.firstName} {p.lastName}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">{p.email}</span>
        </span>
        <span className="text-xs text-muted-foreground">{p.lifecycleStatus}</span>
        <span className="tabular-nums text-xs">{p.activeAttendeeCount} os.</span>
        <span className="tabular-nums text-xs">{formatPlnFromCents(p.paidCents)}</span>
        <span className="tabular-nums text-xs text-amber-700">
          {p.outstandingCents > 0 ? formatPlnFromCents(p.outstandingCents) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</span>
      </summary>
      <div className="space-y-3 bg-muted/20 px-6 py-3 text-xs">
        <div>
          <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
            Telefon
          </div>
          <div>{p.phone ?? "—"}</div>
        </div>
        <div>
          <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
            Uczestnicy ({p.attendees.length})
          </div>
          {p.attendees.length === 0 ? (
            <div className="text-muted-foreground">Brak.</div>
          ) : (
            <ul className="space-y-0.5">
              {p.attendees.map((a) => (
                <li key={a.id}>
                  {a.firstName} {a.lastName} · {a.attendeeTypeId}
                  {a.cancelledAt ? (
                    <span className="ml-2 text-amber-700">
                      anulowany {formatDate(a.cancelledAt)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
            Płatności ({p.payments.length})
          </div>
          {p.payments.length === 0 ? (
            <div className="text-muted-foreground">Brak.</div>
          ) : (
            <ul className="space-y-0.5">
              {p.payments.map((pay) => (
                <li key={pay.id} className="tabular-nums">
                  {pay.kind} · {formatPlnFromCents(pay.amountCents)} · {pay.status}
                  {pay.paidAt ? ` · opłacono ${formatDate(pay.paidAt)}` : ""}
                  {pay.dueAt ? ` · termin ${formatDate(pay.dueAt)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminParticipantRow.tsx
git commit -m "feat(admin): add expandable participant row component"
```

---

## Task 20: Event detail page

**Files:**
- Create: `src/app/admin/organizers/[organizerId]/events/[eventId]/page.tsx`

- [ ] **Step 1: Build the event detail page**

Create `src/app/admin/organizers/[organizerId]/events/[eventId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getEventDetail } from "@/lib/db/queries/admin";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  AdminTable,
  AdminThead,
  AdminTh,
  AdminTbody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { AdminParticipantRow } from "@/components/admin/AdminParticipantRow";
import { formatPlnFromCents } from "@/lib/format-currency";

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
function formatDateTime(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ organizerId: string; eventId: string }>;
}) {
  await requireAdmin();
  const { organizerId, eventId } = await params;
  const detail = await getEventDetail(eventId);
  if (!detail || detail.organizer.id !== organizerId) notFound();

  const e = detail.event;

  return (
    <>
      <AdminTopBar
        crumbs={[
          { label: "Organizatorzy", href: "/admin/organizers" },
          {
            label: detail.organizer.displayName,
            href: `/admin/organizers/${detail.organizer.id}`,
          },
          { label: e.title },
        ]}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-xl border border-border bg-background p-5">
          <h1 className="mb-3 text-2xl font-bold text-primary">{e.title}</h1>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <Detail label="Slug">{e.slug}</Detail>
            <Detail label="Status">{e.status}</Detail>
            <Detail label="Start">{formatDateTime(e.startsAt)}</Detail>
            <Detail label="Koniec">{formatDateTime(e.endsAt)}</Detail>
            <Detail label="Lokalizacja">{e.location ?? "—"}</Detail>
            <Detail label="Pojemność">{e.capacity}</Detail>
            <Detail label="Cena">{formatPlnFromCents(e.priceCents)}</Detail>
            <Detail label="Zaliczka">
              {e.depositCents != null ? formatPlnFromCents(e.depositCents) : "—"}
            </Detail>
            <Detail label="Termin reszty">{formatDate(e.balanceDueAt)}</Detail>
            <Detail label="Waluta">{e.currency}</Detail>
            <Detail label="Opublikowane">{formatDateTime(e.publishedAt)}</Detail>
            <Detail label="Utworzone">{formatDateTime(e.createdAt)}</Detail>
          </dl>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Podsumowanie
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <StatCard label="Zapisani">{detail.aggregates.registered}</StatCard>
            <StatCard label="Lista rezerwowa">{detail.aggregates.waitlisted}</StatCard>
            <StatCard label="Anulowani">{detail.aggregates.cancelled}</StatCard>
            <StatCard label="Aktywni uczestnicy">{detail.aggregates.activeAttendees}</StatCard>
            <StatCard label="Opłacone" variant="navy">
              {formatPlnFromCents(detail.aggregates.succeededSumCents)}
            </StatCard>
            <StatCard label="Oczekujące">
              {formatPlnFromCents(detail.aggregates.pendingSumCents)}
            </StatCard>
            <StatCard label="Zwrócone">
              {formatPlnFromCents(detail.aggregates.refundedSumCents)}
            </StatCard>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Uczestnicy ({detail.participants.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Imię / email</span>
              <span>Status</span>
              <span>Osoby</span>
              <span>Opłacone</span>
              <span>Brakuje</span>
              <span>Zapisany</span>
            </div>
            {detail.participants.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Brak uczestników.
              </div>
            ) : (
              detail.participants.map((p) => <AdminParticipantRow key={p.id} p={p} />)
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Wszystkie płatności ({detail.payments.length})
          </h2>
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>Uczestnik</AdminTh>
                <AdminTh>Typ</AdminTh>
                <AdminTh className="text-right">Kwota</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Opłacono</AdminTh>
                <AdminTh>Termin</AdminTh>
                <AdminTh>Stripe session</AdminTh>
                <AdminTh>Stripe PI</AdminTh>
              </tr>
            </AdminThead>
            <AdminTbody>
              {detail.payments.length === 0 ? (
                <AdminTr>
                  <AdminTd className="py-4 text-center text-muted-foreground">
                    Brak płatności.
                  </AdminTd>
                </AdminTr>
              ) : (
                detail.payments.map((pay) => (
                  <AdminTr key={pay.id}>
                    <AdminTd>
                      <div className="font-medium">{pay.participantName}</div>
                      <div className="text-xs text-muted-foreground">
                        {pay.participantEmail}
                      </div>
                    </AdminTd>
                    <AdminTd className="text-xs">{pay.kind}</AdminTd>
                    <AdminTd className="text-right tabular-nums">
                      {formatPlnFromCents(pay.amountCents)}
                    </AdminTd>
                    <AdminTd className="text-xs">{pay.status}</AdminTd>
                    <AdminTd className="text-xs text-muted-foreground">
                      {formatDateTime(pay.paidAt)}
                    </AdminTd>
                    <AdminTd className="text-xs text-muted-foreground">
                      {formatDateTime(pay.dueAt)}
                    </AdminTd>
                    <AdminTd className="font-mono text-[10px] text-muted-foreground">
                      {pay.stripeSessionId ?? "—"}
                    </AdminTd>
                    <AdminTd className="font-mono text-[10px] text-muted-foreground">
                      {pay.stripePaymentIntentId ?? "—"}
                    </AdminTd>
                  </AdminTr>
                ))
              )}
            </AdminTbody>
          </AdminTable>
        </section>
      </main>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </>
  );
}
```

- [ ] **Step 2: Smoke test**

From organizer detail, click an event. Expected: event detail with participants (expandable) and payments table.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/organizers/[organizerId]/events/[eventId]/page.tsx"
git commit -m "feat(admin): add event detail page with participants and payments"
```

---

## Task 21: End-to-end manual verification

**No new files.** Walk the full flow on `npm run dev` against a populated local DB.

- [ ] **Step 1: Visit `/admin` without a cookie**

Expected: redirected to `/admin/login`.

- [ ] **Step 2: Submit a wrong password**

Expected: re-renders with "Nieprawidłowe hasło lub zbyt wiele prób."

- [ ] **Step 3: Submit the correct password (from `.dev.vars`)**

Expected: redirected to `/admin`; overview page renders.

- [ ] **Step 4: Click "Organizatorzy" / a row / an event**

Expected: each level renders; back links work.

- [ ] **Step 5: Try `/admin` on a tenant subdomain**

In dev: `curl -H 'Host: someorg.localhost:3000' http://localhost:3000/admin -i`
Expected: `404 Not Found`.

- [ ] **Step 6: Click "Wyloguj"**

Expected: cookie cleared; redirected to `/admin/login`; re-visiting `/admin` shows the login form.

- [ ] **Step 7: Brute-force a bad password 6 times in a row**

Expected: 6th attempt shows the same error (rate limiter trips). Wait 60s and try again — succeeds.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including `admin-auth.test.ts`.

- [ ] **Step 9: Run the production build**

Run: `npm run build`
Expected: build completes with no type errors. (This is the strongest type check this project has.)

- [ ] **Step 10: No commit unless build surfaced fixes** — if it did, commit with a clear message and re-run.

---

## Task 22: Configure production secrets and regenerate CF env types

**Files:**
- Modify: `cloudflare-env.d.ts` (via `npm run cf-typegen`)

- [ ] **Step 1: Set the production secrets in Cloudflare**

Run (ask the user to confirm the password before running):

```bash
npx wrangler secret put ADMIN_PASSWORD
# (paste the chosen production password when prompted)
npx wrangler secret put ADMIN_SESSION_SECRET
# (paste a 32+ byte random string; generate with: openssl rand -hex 32)
```

> Do NOT run these without explicit user confirmation — they modify shared infra.

- [ ] **Step 2: Regenerate the env type file**

Run: `npm run cf-typegen`
Expected: `cloudflare-env.d.ts` updated with `ADMIN_PASSWORD: string;` and `ADMIN_SESSION_SECRET: string;` in the `Cloudflare.Env` interface.

- [ ] **Step 3: Commit the regenerated file**

```bash
git add cloudflare-env.d.ts
git commit -m "chore(admin): regenerate CF env types after adding admin secrets"
```

- [ ] **Step 4: Deploy via the project's existing deploy command** (only when user is ready)

Run: `npm run deploy`
Expected: build + upload succeed; visit `https://wyjazdo.pl/admin/login` in the browser and log in.

---

## Done

The admin panel is live at `/admin`, gated by `ADMIN_PASSWORD`, with overview stats, organizer browsing, and event drill-down. All read-only.

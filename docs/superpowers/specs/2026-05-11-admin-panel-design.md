# Admin Panel — Design Spec

**Date:** 2026-05-11
**Status:** Approved (design phase)

## Goal

A simple, read-only admin panel for the platform owner (single user) to monitor the Wyjazdo platform: see top-level stats, browse organizers, drill into any organizer to see their events, drill into any event to see participants and payments.

No mutations. No moderation. No multi-admin support.

## Non-goals

- Editing or deleting any records.
- Suspending organizers, refunding payments, or any Stripe action.
- Impersonating organizers.
- Multiple admin users, roles, or permissions.
- Audit logs (single user; not needed).
- Real-time updates, push, or websockets — fresh page loads only.
- Caching or precomputation of stats.

## Architecture

### Location & routing

- New route segment `src/app/admin/` on the root domain only (e.g. `wyjazdo.pl/admin`). Regular segment, not a parenthesised route group — `/admin` must appear in the URL.
- Tenant subdomains (`{slug}.wyjazdo.pl/admin`) must NOT serve the admin panel. The middleware tenant-rewrite branch runs first; the admin path needs to be reached only when `tenant.kind !== "tenant"`.
- The admin routes do not go through Clerk auth. They use a separate password gate (see below).
- Existing middleware at `src/middleware.ts` must be updated so that `/admin` (and `/api/admin`, if added later) on the root domain bypasses Clerk's `auth.protect()` — Clerk is only used for organizer-facing routes.

### Authentication

- A single shared secret env var `ADMIN_PASSWORD` (Cloudflare secret).
- A second env var `ADMIN_SESSION_SECRET` (Cloudflare secret) used to HMAC the session cookie. Must be at least 32 bytes.
- `GET /admin/login` renders a minimal password form.
- `POST /admin/login`:
  - Reads `password` from the form.
  - Constant-time compares against `ADMIN_PASSWORD` (using `crypto.subtle.timingSafeEqual`-equivalent via comparing fixed-length digests).
  - On success: sets cookie `admin_session` (HTTP-only, Secure, SameSite=Lax, Path=/admin, Max-Age=604800 = 7 days) containing `${expiryUnixSec}.${base64url(hmacSha256(ADMIN_SESSION_SECRET, expiryUnixSec))}`.
  - On failure: re-renders the form with a generic "Nieprawidłowe hasło" error.
- `POST /admin/logout`: clears the cookie, redirects to `/admin/login`.
- Helper `requireAdmin()` in `src/lib/admin-auth.ts`:
  - Reads the cookie, parses, verifies HMAC and expiry.
  - On success: returns void (request continues).
  - On failure: throws a `NEXT_REDIRECT` to `/admin/login` (Next.js `redirect()`).
- Every page in `src/app/admin/` other than `login` calls `await requireAdmin()` as the first line of its server component.
- Sliding session: if a request comes in with less than 24h until expiry, re-issue the cookie with a fresh 7-day expiry. Implement inside `requireAdmin()` by writing a `Set-Cookie` via Next's `cookies()` API.
- Login is rate-limited via the existing `src/lib/rate-limit.ts`: 5 attempts per 15 minutes keyed by IP (from `x-forwarded-for` / `cf-connecting-ip`).
- The cookie is not bound to IP or user agent — single user, low risk, simpler.

### Routes & files

```
src/app/admin/
  layout.tsx              # minimal layout: top bar + main; calls requireAdmin (except login)
  page.tsx                # overview / stats dashboard
  login/
    page.tsx              # password form
    actions.ts            # server actions: login, logout
  organizers/
    page.tsx              # list with search & pagination
    [organizerId]/
      page.tsx            # organizer detail + their events table
      events/
        [eventId]/
          page.tsx        # event detail + participants + payments
src/lib/admin-auth.ts     # requireAdmin, issueSession, verifySession, rate-limit wrapper
src/lib/db/queries/admin.ts  # all admin queries (separate from tenant-scoped queries)
src/components/admin/
  AdminTopBar.tsx
  AdminStatCard.tsx       # or reuse src/components/dashboard/StatCard.tsx if compatible
  AdminTable.tsx          # thin styled <table> wrapper used across pages
```

The admin layout sits inside the `admin/` segment so the standard root layout (which assumes the organizer dashboard chrome) does not interfere. The admin layout renders its own header and does NOT include the organizer Sidebar / MobileTabBar.

### Middleware changes

In `src/middleware.ts`:

- The tenant rewrite check happens first. `/admin` on a tenant subdomain should 404 (or redirect to the apex). Simplest: in the `tenant.kind === "tenant"` branch, if the path starts with `/admin`, return a `NextResponse` with a 404 (or rewrite to `/not-found`).
- On the root domain branch, add `/admin` to the routes that bypass `auth.protect()`. The current `isProtectedRoute` matcher already excludes `/admin`, so the existing behavior is fine, but verify the matcher hasn't been widened.
- The Clerk `clerkMiddleware` wrapper still runs for `/admin` (which is OK — it just attaches the auth context without protecting). If we want to opt out entirely, we can short-circuit at the top of the middleware when `url.pathname.startsWith("/admin")` and the host is the root domain. Recommended: short-circuit at the top with `NextResponse.next()` before `clerkMiddleware` runs, to avoid any chance of Clerk session-cookie work for admin requests.

## Pages

### `/admin` — Overview

Six stat groups using `AdminStatCard`s in a responsive grid, plus two "recent" lists at the bottom.

**Organizers card group:**
- Total organizers (all-time count)
- New in last 7 days
- New in last 30 days
- "Active" — count of organizers who have at least one published event

**Events card group:**
- Total events
- Upcoming published (`status = 'published'` AND `startsAt > now`)
- Drafts (`status = 'draft'`)
- Archived (`status = 'archived'`)

**Participants card group:**
- Total active participants (`lifecycleStatus = 'active'`)
- New in last 7 days
- New in last 30 days

**Payments card group:**
- Total succeeded count + sum (PLN), all-time
- Succeeded last 30 days: count + sum
- Succeeded last 7 days: count + sum
- Pending count
- Failed count

**Recent organizers (last 10):**
- displayName · subdomain (linked to `https://{subdomain}.{rootDomain}`) · createdAt · Stripe onboarded? · contact email

**Recent succeeded payments (last 10):**
- paidAt · amount · organizer displayName · event title · participant name + email

### `/admin/organizers` — List

- Server-side paginated table, 50 rows per page. Query params: `?page=N&q=foo`.
- Columns: displayName, subdomain (link), contact email, # events (all statuses), # active participants across all their events, sum of succeeded payments (PLN), Stripe onboarded? (✓/✗), created.
- Sortable: click column headers to toggle sort. Implemented via `?sort=field&dir=asc|desc` and re-querying server-side. Sortable columns: displayName, # events, # participants, revenue, created. Default sort: created desc.
- Search: simple text input that posts `q` and clears `page`. Matches `LIKE %q%` against `displayName`, `subdomain`, and `contactEmail`.
- Each row links to `/admin/organizers/{id}`.

### `/admin/organizers/[organizerId]` — Detail

- Organizer profile block at top:
  - Logo preview (if `logoUrl`), brand color swatch, displayName, description.
  - Subdomain (external link), contactEmail, contactPhone, socialLinks (parsed JSON, rendered as link list).
  - Created at, updated at, terms accepted at, DPA accepted at.
  - Stripe: account id (text), onboardingComplete, payoutsEnabled, lastSyncedAt.
  - Aggregate stats: # events (by status), # active participants, total revenue.
- Events table below:
  - Columns: title (link to `/admin/organizers/{id}/events/{eventId}`), startsAt, endsAt, status, capacity, registered (active participants), revenue (sum of succeeded payments for that event), created.
  - Default sort: startsAt desc. Sortable client-side OR server-side — server-side via `?eventsSort=` to stay consistent with the list page.

### `/admin/organizers/[organizerId]/events/[eventId]` — Event detail

- Event header block: title, slug, dates, location, capacity, status, priceCents (formatted), depositCents (formatted), balanceDueAt, currency, publishedAt, createdAt, updatedAt, organizer breadcrumb back-link.
- Aggregate row: # registered (active participants), # waitlisted, # cancelled, # active attendees, total succeeded, total pending, total refunded.
- Participants table:
  - Columns: name, email, phone, lifecycleStatus, # active attendees, total paid (sum succeeded), total outstanding (sum pending), createdAt.
  - Sort by createdAt desc default.
  - Click a row to expand inline (no separate page) to show attendees (name + attendeeType + cancelledAt) and per-participant payments. Implementation: a small client component that toggles `<details>` — no separate route.
- Payments table:
  - Columns: paidAt (or dueAt if not paid), kind, amountCents formatted, status, stripeSessionId, stripePaymentIntentId, lastReminderAt, expiresAt.
  - Default sort: createdAt desc.

## Data layer

All queries live in `src/lib/db/queries/admin.ts`. Naming and patterns follow the existing `src/lib/db/queries/*` files (Drizzle, async functions taking a `db` instance from `getDb()` if that's the pattern — verify against existing query files).

### Helpers

- `now()` → `Math.floor(Date.now() / 1000)` (or whatever unit `created_at` uses; check schema — currently `integer("created_at")` which the codebase treats as seconds; verify by reading one existing query file).
- `daysAgo(n)` → `now() - n * 86400`.

### Functions

```ts
getOverviewStats(): Promise<{
  organizers: { total: number; new7d: number; new30d: number; active: number };
  events: { total: number; upcomingPublished: number; draft: number; published: number; archived: number };
  participants: { totalActive: number; new7d: number; new30d: number };
  payments: {
    succeededAllCount: number; succeededAllSumCents: number;
    succeeded30dCount: number; succeeded30dSumCents: number;
    succeeded7dCount: number; succeeded7dSumCents: number;
    pendingCount: number;
    failedCount: number;
  };
}>

getRecentOrganizers(limit: number = 10): Promise<Array<{
  id: string; displayName: string; subdomain: string; contactEmail: string | null;
  createdAt: number; stripeOnboardingComplete: boolean;
}>>

getRecentSucceededPayments(limit: number = 10): Promise<Array<{
  paymentId: string; amountCents: number; currency: string; paidAt: number;
  organizerId: string; organizerDisplayName: string;
  eventId: string; eventTitle: string;
  participantId: string; participantName: string; participantEmail: string;
}>>

listOrganizers(params: {
  q?: string; page: number; pageSize: number;
  sort?: "displayName" | "events" | "participants" | "revenue" | "created";
  dir?: "asc" | "desc";
}): Promise<{
  rows: Array<{
    id: string; displayName: string; subdomain: string; contactEmail: string | null;
    eventCount: number; participantCount: number; revenueCents: number;
    stripeOnboardingComplete: boolean; createdAt: number;
  }>;
  totalCount: number;
}>

getOrganizerDetail(organizerId: string): Promise<{
  organizer: Organizer; // full row
  stats: { eventsByStatus: Record<EventStatus, number>; activeParticipants: number; revenueCents: number };
  events: Array<{
    id: string; title: string; slug: string; status: EventStatus;
    startsAt: number; endsAt: number; capacity: number;
    registeredCount: number; revenueCents: number; createdAt: number;
  }>;
} | null>  // null if organizer not found

getEventDetail(eventId: string): Promise<{
  event: Event;
  organizer: { id: string; displayName: string; subdomain: string };
  aggregates: {
    registered: number; waitlisted: number; cancelled: number;
    activeAttendees: number;
    succeededSumCents: number; pendingSumCents: number; refundedSumCents: number;
  };
  participants: Array<{
    id: string; firstName: string; lastName: string; email: string; phone: string | null;
    lifecycleStatus: ParticipantStatus;
    activeAttendeeCount: number; paidCents: number; outstandingCents: number;
    createdAt: number;
    attendees: Array<{ id: string; firstName: string; lastName: string; attendeeTypeId: string; cancelledAt: number | null }>;
    payments: Array<Payment>;
  }>;
  payments: Array<Payment & { participantName: string; participantEmail: string }>;
} | null>
```

`getEventDetail` returns participants with their attendees and payments pre-attached so the inline expand needs no further fetches. With D1's per-request cost, one query with joins (or a small fixed number of queries) is cheaper than N+1.

### Query strategy

- Use Drizzle's `sql` template tag for aggregate subqueries; the existing codebase already does this in other query files.
- Run independent aggregates in parallel with `Promise.all` (D1 supports concurrent reads within a single request).
- All "amounts" stay as `cents` (integer) through the data layer. Formatting to PLN happens only at render time via `formatCurrency` from `src/lib/format-currency.ts`.
- Event "registered" count = participants where `lifecycleStatus = 'active'`. Active attendees = attendees where `cancelled_at IS NULL`. Revenue = sum of `amount_cents` of payments with `status = 'succeeded'`.

## UI / components

- Minimal Tailwind-only chrome. No new component library.
- New components in `src/components/admin/`:
  - `AdminTopBar.tsx` — fixed top bar: "Wyjazdo Admin", breadcrumbs derived from path, logout button.
  - `AdminStatCard.tsx` — thin wrapper or alias of `src/components/dashboard/StatCard.tsx`. Check if `StatCard` fits the admin context; if it carries dashboard-specific assumptions (icons, brand color), make a sibling.
  - `AdminTable.tsx` — basic styled `<table>` with sticky header and zebra rows. Used everywhere.
  - `AdminPagination.tsx` — prev / next / page numbers; takes total + page + pageSize + buildHref.
  - `AdminSortHeader.tsx` — column header that renders sort arrows and links to `?sort=&dir=`.
- All text in Polish (matches the rest of the product). Headings: "Przegląd", "Organizatorzy", "Wydarzenia", etc.
- All currency rendered via `formatCurrency` in PLN.
- Dates rendered with the project's existing date formatter (check `src/lib/utils/` for a date helper, or use `date-fns` `format` with `pl` locale to match the rest of the app).

## Error handling

- 404 (Next `notFound()`) when an organizer or event id doesn't exist.
- 500 surface: rely on the project's existing `error.tsx` boundary; admin can share the root-level `src/app/error.tsx`.
- Login form re-renders with a single generic error message ("Nieprawidłowe hasło lub zbyt wiele prób") — same message for bad password and rate-limit, to avoid leaking which one tripped.

## Testing

- Vitest unit tests for `src/lib/admin-auth.ts`:
  - HMAC signing and verification round-trip.
  - Reject expired tokens.
  - Reject malformed cookies.
  - Reject tampered signatures.
  - Constant-time compare returns correct boolean and runs in roughly equal time for matching/non-matching inputs (functional check, not perf).
- Vitest unit tests for the admin query helpers that have non-trivial logic (date-range bucketing in `getOverviewStats`, search/sort in `listOrganizers`). Use the existing D1 test setup if one exists in the project; otherwise inline an in-memory SQLite via the same Drizzle adapter the other test files use (see how `webhook-handler.test.ts` etc. handle DB tests).
- No E2E tests for the admin panel — it's a single-user tool.

## Security

- All admin pages are server-rendered; no admin data is shipped to the client beyond what's rendered.
- Cookie is HTTP-only and Secure. SameSite=Lax (no cross-site POSTs to admin are expected; login form is same-origin).
- `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` set as Cloudflare secrets, never committed.
- Constant-time password compare.
- Login is rate-limited.
- Logout invalidates the cookie client-side; since sessions are stateless, there's no server-side revocation — accepted given the threat model (single user, can rotate `ADMIN_SESSION_SECRET` to nuke all sessions if needed).
- The admin path is excluded from `robots.txt`. Check `src/app/robots.ts` — if it currently has an allow-all rule, add a `disallow: /admin` entry.
- No new API routes are introduced. All admin actions are server actions or server-component data loads, scoped to the admin route group.

## Configuration

New Cloudflare secrets (set via `wrangler secret put`):

- `ADMIN_PASSWORD` — the password.
- `ADMIN_SESSION_SECRET` — a random 32+ byte secret for HMAC signing.

Add to `cloudflare-env.d.ts` as part of the build, regenerated via `npm run cf-typegen`.

## Open questions

None at design time. Implementation plan will pin down:

- Exact reuse vs. fork of `StatCard`.
- Whether `getEventDetail` is one big join or several parallel queries (decided during implementation based on D1 query shape).
- Date formatting helper to standardise on.

# wyjazdo.pl — MVP Design

**Date:** 2026-04-13
**Status:** Implemented. Partially superseded by [2026-04-15 Participants, Deposits, and Payouts](2026-04-15-participants-deposits-payouts-design.md).

> **Note:** The payments model, participant status lifecycle, webhook handling, and several environment details described below were replaced by the 2026-04-15 spec. Specifically: `participants` no longer stores payment state (moved to a `payments` table); status is derived, not stored; Checkout Sessions use Stripe Connect direct charges; and the middleware rewrites to `/sites/[subdomain]/...` (not `/_sites/`). This document remains useful as architectural context for routing, multi-tenancy, and the original product model.

## 1. Product summary

wyjazdo.pl is a multi-tenant platform for organizers of trips, retreats, workshops, and other group travel events in Poland. The MVP covers a single workflow end-to-end:

1. Organizer creates a profile (reachable at `organizername.wyjazdo.pl`).
2. Organizer creates an event (reachable at `organizername.wyjazdo.pl/event-slug`).
3. Participant views the event page.
4. Participant signs up via a registration form (with organizer-defined custom questions).
5. Participant pays online (BLIK, Przelewy24, cards).
6. Organizer manages participants, payment status, and waitlist in a dashboard.

Explicitly **out of scope** for the MVP: marketplace/discovery, following organizers, email automation, broadcasts, invoicing, refund engine, custom external domains, page builder.

## 2. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | App Router is the recommended path; strong server-first model fits Workers. |
| Runtime | Cloudflare Workers via `@opennextjs/cloudflare` | Officially recommended by Cloudflare for new Next.js projects. Full App Router support (Server Actions, RSC streaming, middleware). Bindings accessed via `getCloudflareContext()`. |
| Database | Cloudflare D1 (SQLite) | In-spec. Accessed via Workers binding. |
| ORM | Drizzle ORM | Best D1 ergonomics, edge-safe, type-safe schema, SQL-first migrations. |
| Auth | Clerk | Lowest-friction third-party auth for Next.js + Workers. Middleware-based protection, pre-built UI, generous free tier. |
| Payments | Stripe Checkout (hosted) | Supports cards, BLIK, and Przelewy24 in Poland from a single integration. Hosted UI means minimal payment code; webhook is the source of truth. |
| Styling | Tailwind CSS | Pragmatic default; low abstraction overhead. |

**Single deployment.** There is one Cloudflare Worker serving all subdomains. Organizers do not get separate deployments or separate Clerk orgs; multi-tenancy is a data concern.

## 3. Project structure

```
wyjazdo/
├── src/
│   ├── middleware.ts                      # subdomain detection + Clerk composition
│   ├── app/
│   │   ├── page.tsx                       # apex: wyjazdo.pl marketing
│   │   ├── dashboard/                     # apex: organizer dashboard (Clerk-protected)
│   │   │   ├── page.tsx                   #   event list
│   │   │   ├── onboarding/page.tsx        #   first login: pick subdomain, fill profile
│   │   │   ├── settings/page.tsx          #   edit organizer profile
│   │   │   └── events/
│   │   │       ├── new/page.tsx
│   │   │       └── [id]/
│   │   │           ├── page.tsx           #   edit event + participant table
│   │   │           └── export/route.ts    #   CSV download
│   │   ├── api/
│   │   │   ├── register/route.ts          # POST: create pending participant + Checkout Session
│   │   │   └── stripe/webhook/route.ts    # POST: Stripe webhook — source of truth
│   │   └── _sites/                        # INTERNAL — only reachable via middleware rewrite
│   │       └── [subdomain]/
│   │           ├── page.tsx               # organizer profile
│   │           └── [eventSlug]/
│   │               ├── page.tsx           # event page
│   │               ├── register/page.tsx  # registration form
│   │               └── thanks/page.tsx    # post-payment landing
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts                  # Drizzle schema
│   │   │   ├── client.ts                  # getDb() — resolves D1 binding from CF context
│   │   │   └── migrations/                # SQL migrations
│   │   ├── tenant.ts                      # host → subdomain → organizer resolution
│   │   ├── stripe.ts                      # Stripe client factory
│   │   ├── capacity.ts                    # capacity check + reservation
│   │   └── ids.ts                         # ulid generator
│   └── components/{ui, organizer, dashboard}
├── drizzle.config.ts
├── wrangler.jsonc                         # D1 binding, secrets, env vars, cron
├── open-next.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

**Principle:** every file has one clear purpose. Public organizer/event pages live under `_sites/[subdomain]/...`, dashboard under `dashboard/...`, API under `api/...`. Business logic (capacity, tenant resolution, Stripe) lives in `lib/` — not in route files — so it is directly testable.

## 4. Routing strategy

### Subdomain resolution

A single `src/middleware.ts` handles all host-based routing. Execution order per request:

1. Read `host` header; strip port and normalize to lowercase.
2. Determine environment root domain (`wyjazdo.pl` in prod, `localhost:3000` in dev, `*.workers.dev` preview). Root domain comes from `NEXT_PUBLIC_ROOT_DOMAIN` env var.
3. If host equals root domain → apex request. Pass through. Clerk middleware protects `/dashboard/*`.
4. If host is `<subdomain>.<root>` where subdomain is NOT in the reserved set → **rewrite** `/{path}` to `/_sites/{subdomain}/{path}`. URL bar is unchanged (rewrite, not redirect). No Clerk on these routes.
5. Reserved subdomains (`www`, `app`, `api`, `dashboard`, `admin`, `assets`, `static`) are treated as apex.

### Dev subdomain handling

Modern browsers resolve any `*.localhost` to `127.0.0.1` with no configuration. Developers visit `acme.localhost:3000` directly; no `/etc/hosts` edits required. `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000` in dev.

### Dashboard placement

Dashboard is at `wyjazdo.pl/dashboard`, not `app.wyjazdo.pl`, for MVP. This keeps Clerk configured for one domain and avoids cross-subdomain session concerns. Can be lifted to `app.wyjazdo.pl` later without schema changes.

### Public vs private routing matrix

| Host | Path | Resolves to | Auth |
|---|---|---|---|
| `wyjazdo.pl` | `/` | marketing landing | public |
| `wyjazdo.pl` | `/dashboard/*` | organizer dashboard | Clerk required |
| `wyjazdo.pl` | `/api/stripe/webhook` | Stripe webhook | signature-verified |
| `wyjazdo.pl` | `/api/register` | registration handler | public (rate-limited) |
| `acme.wyjazdo.pl` | `/` | organizer profile (rewrite → `/_sites/acme`) | public |
| `acme.wyjazdo.pl` | `/workshop-1` | event page (rewrite → `/_sites/acme/workshop-1`) | public |
| `acme.wyjazdo.pl` | `/workshop-1/register` | registration form | public |

## 5. Data model

Three tables. All IDs are [ULIDs](https://github.com/ulid/spec) (sortable, URL-safe, no coordination). Timestamps are `INTEGER` unix milliseconds.

### `organizers`

```
id              text PRIMARY KEY          -- ulid
clerk_user_id   text UNIQUE NOT NULL
subdomain       text UNIQUE NOT NULL      -- lowercased, validated /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/
display_name    text NOT NULL
description     text
logo_url        text
cover_url       text
brand_color     text                      -- #RRGGBB
contact_email   text
contact_phone   text
social_links    text                      -- JSON: {website?, instagram?, facebook?}
created_at      integer NOT NULL
updated_at      integer NOT NULL
```

One row per Clerk user for MVP. Multi-org-per-user can be added later via a join table without breaking this schema.

### `events`

```
id                text PRIMARY KEY        -- ulid
organizer_id      text NOT NULL REFERENCES organizers(id)
slug              text NOT NULL
title             text NOT NULL
description       text
location          text
starts_at         integer NOT NULL
ends_at           integer NOT NULL
price_cents       integer NOT NULL
currency          text NOT NULL DEFAULT 'PLN'
capacity          integer NOT NULL
cover_url         text
status            text NOT NULL           -- draft | published | archived
custom_questions  text                    -- JSON: [{id, label, type, required}]
created_at        integer NOT NULL
updated_at        integer NOT NULL
UNIQUE(organizer_id, slug)
INDEX events_organizer_idx ON events(organizer_id)
```

Only `status='published'` events are visible on the public site. `draft` events are hidden; `archived` events are hidden from public listings but retain their participant data.

Custom question types for MVP: `short_text`, `long_text`, `select` (with enumerated options). Stored as JSON on the event definition, answered as JSON on the participant. No separate questions/answers tables — query requirements don't warrant it.

### `participants`

```
id                         text PRIMARY KEY   -- ulid
event_id                   text NOT NULL REFERENCES events(id)
first_name                 text NOT NULL
last_name                  text NOT NULL
email                      text NOT NULL
phone                      text
custom_answers             text               -- JSON: {question_id: answer}
status                     text NOT NULL      -- pending|paid|cancelled|refunded|waitlisted
expires_at                 integer            -- only set when status='pending'
stripe_session_id          text
stripe_payment_intent_id   text
amount_paid_cents          integer
paid_at                    integer
created_at                 integer NOT NULL
updated_at                 integer NOT NULL
INDEX participants_event_status_idx ON participants(event_id, status)
INDEX participants_stripe_session_idx ON participants(stripe_session_id)
```

**Status state machine:**

```
           ┌─ paid (webhook checkout.session.completed)
pending ───┼─ cancelled (webhook session.expired or cron cleanup)
           └─ refunded (future; out of MVP, column reserved)

waitlisted — terminal in MVP (organizer promotes manually later)
```

A single `participants` table covers all lifecycle states. No separate `registrations`/`payments`/`waitlist` tables. Justification: state set is small, all queries are per-event, and CSV export is trivial from one row per participant.

## 6. Core workflows

### 6.1 Organizer onboarding

1. New user signs in via Clerk → landed on `/dashboard`.
2. Dashboard checks for an `organizers` row where `clerk_user_id = auth().userId`.
3. If missing → redirect to `/dashboard/onboarding`. User chooses subdomain (validated, unique check), sets display name and description.
4. Row inserted. Redirect back to `/dashboard`.

### 6.2 Event creation

Dashboard form at `/dashboard/events/new`. Validates with zod. On submit, inserts `events` row with `status='draft'`. Organizer edits freely, then sets `status='published'` to make it live.

### 6.3 Participant registration (happy path)

```
User opens acme.wyjazdo.pl/workshop-1              (public event page)
  ↓ clicks "Sign up" CTA
User opens acme.wyjazdo.pl/workshop-1/register     (registration form)
  ↓ submits form
POST /api/register
  ├─ zod-validate input (first_name, last_name, email, phone, custom_answers)
  ├─ load event by (organizer_id, slug); verify status='published'
  ├─ run capacity check (see 6.4)
  │
  ├─ HAS ROOM:
  │    INSERT participants (status='pending', expires_at = now + 30min)
  │    stripe.checkout.sessions.create({
  │      mode: 'payment',
  │      payment_method_types: ['card', 'blik', 'p24'],
  │      line_items: [{ price_data, quantity: 1 }],
  │      customer_email: email,
  │      metadata: { participant_id },
  │      success_url: 'https://acme.wyjazdo.pl/workshop-1/thanks?session_id={CHECKOUT_SESSION_ID}',
  │      cancel_url:  'https://acme.wyjazdo.pl/workshop-1/register',
  │      expires_at: floor((now + 30min) / 1000),  // align with our pending TTL
  │    })
  │    UPDATE participants SET stripe_session_id=...
  │    → respond { redirect: session.url }
  │
  └─ FULL:
       INSERT participants (status='waitlisted')
       → respond { redirect: '/workshop-1/thanks?waitlisted=1' }
```

User is redirected to Stripe's hosted page, pays, returns to `/thanks`. The thanks page does NOT rely on the redirect to mark payment complete — it reads the current participant status from the DB (populated by webhook). If webhook hasn't fired yet, it shows "processing" with auto-refresh.

### 6.4 Capacity rule

Single function in `src/lib/capacity.ts`:

```sql
SELECT COUNT(*) FROM participants
WHERE event_id = ?
  AND (
    status = 'paid'
    OR (status = 'pending' AND expires_at > ?)  -- now in ms
  )
```

Returns number of "taken" spots. If `taken < event.capacity`, the caller may insert a `pending` row. Otherwise the caller must route to waitlist.

Capacity enforcement is advisory at query time; the authoritative guard is the DB-level check in `POST /api/register`, executed under the same request path as the INSERT. D1 does not support multi-statement transactions for our case, but the 30-minute pending window plus ULID-ordered inserts makes practical oversell only possible under extreme concurrency (sub-second). For MVP that is acceptable; if we later see oversell, move the check+insert into a Durable Object keyed by `event_id` for serialization.

### 6.5 Stripe webhook — source of truth

`POST /api/stripe/webhook`

1. Verify signature with `STRIPE_WEBHOOK_SECRET` using `stripe.webhooks.constructEventAsync` (required on Workers — the sync version uses Node crypto).
2. Switch on `event.type`:
   - `checkout.session.completed` → find participant by `stripe_session_id`. If `status='pending'`: set `status='paid'`, `paid_at=now`, `amount_paid_cents = amount_total`, `stripe_payment_intent_id=...`, clear `expires_at`. Idempotent no-op if already `paid`.
   - `checkout.session.expired` → if `status='pending'` with matching `stripe_session_id`, set `status='cancelled'` (frees spot).
   - `payment_intent.payment_failed` → same as expired.
3. Respond `200` even on unknown event types (Stripe retries on non-2xx).

All updates include a `WHERE status = 'pending'` guard for idempotency; re-delivered webhooks are safe.

### 6.6 Expired pending cleanup (cron)

Cloudflare Cron Trigger (`*/10 * * * *`) runs a scheduled Worker handler:

```sql
UPDATE participants
SET status = 'cancelled', updated_at = ?
WHERE status = 'pending' AND expires_at < ?
```

This is tidiness only — the capacity query already excludes expired pendings. Keeps dashboard counts truthful.

### 6.7 Dashboard

- `/dashboard` → list of events owned by the current organizer, each row showing paid count / capacity / waitlist count.
- `/dashboard/events/[id]` → event editor + participant table. Columns: status, name, email, phone, custom answers (inline), paid_at, amount. Filter by status. Separate tab for waitlist.
- `/dashboard/events/[id]/export` → GET streams CSV. Columns: status, first_name, last_name, email, phone, created_at, paid_at, amount_paid_cents, then one column per custom question keyed by question `id`.
- `/dashboard/settings` → edit organizer profile (display name, description, logo, cover, brand color, contact, social links). Subdomain is editable once with a uniqueness check; subsequent edits require manual admin action for MVP (prevents accidental URL breakage).

**Auth boundary:** every dashboard DB query joins through the authenticated organizer (`organizers.clerk_user_id = auth().userId`). Cross-tenant reads are impossible at the query layer, not just the middleware layer.

## 7. Error handling

- **Form validation errors** → zod, returned as field-level messages, rendered inline.
- **Capacity race loser** → registration endpoint returns a structured error (`full`); client shows "This event just filled up" with CTA to join waitlist.
- **Payment failure / abandonment** → pending expires in 30 min; slot returns automatically. User can re-register.
- **Webhook signature failure** → log, return 400 (Stripe will not retry).
- **Webhook for unknown participant** → log + return 200 (prevents retry storms).
- **Subdomain not found** → `/_sites/[subdomain]/page.tsx` returns a `notFound()`; Next renders 404.
- **Event not found or not published** → same.
- **Clerk session missing on dashboard route** → middleware redirects to Clerk sign-in.

## 8. Testing strategy

- **Schema/migrations** → applied via `drizzle-kit` locally and in CI; tested against a local D1 via `wrangler d1 execute`.
- **Capacity logic** → unit tests against an in-memory SQLite (same SQL dialect as D1) covering: empty event, partial fill, exactly at cap, pending expiry boundary, waitlist routing.
- **Webhook handler** → unit tests with canned Stripe event fixtures; verifies idempotency (double-delivery of `completed`, late-arriving `expired`).
- **Subdomain middleware** → unit tests over the host→route-target mapping (apex, known subdomain, reserved, unknown).
- **End-to-end** → manual smoke pass through the full register→pay→webhook→dashboard flow against a dev Worker + Stripe test mode. Automated E2E is out of scope for MVP.

## 9. Environment & configuration

`wrangler.jsonc` binds:

- `DB` → D1 database
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLERK_SECRET_KEY`
- Vars: `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Cron trigger: `*/10 * * * *` → expired-pending cleanup

`.dev.vars` holds the same secrets for local `wrangler dev`.

## 10. Explicit non-goals for MVP

Listed here so they don't creep in:

- Marketplace / public event discovery across organizers
- Following organizers, notifications
- Email automation, broadcasts, reminders
- Invoice generation, accounting integration
- Automated refunds (column reserved, no UI)
- Custom external domains (e.g., `trips.acme.com`)
- Drag-and-drop page builder; any layout customization beyond the defined profile fields
- Multi-organizer teams (one Clerk user = one organizer in MVP)
- Multi-currency beyond PLN
- Waitlist promotion automation (organizer promotes manually later — column is present)

## 11. Extension points (explicit, for later)

Designed in now so they are cheap later:

- Multi-user-per-organizer → add `organizer_members (organizer_id, clerk_user_id, role)` table; dashboard queries switch to membership.
- Multi-organizer-per-user → same as above from the other side.
- Waitlist promotion → add endpoint `POST /dashboard/events/[id]/waitlist/[pid]/promote` that flips `waitlisted` → `pending` and creates a Checkout Session.
- Refunds → `refunded` status already in state machine; add webhook handler for `charge.refunded`.
- Custom domains → middleware already maps host→tenant; replace subdomain lookup with a `domains (host, organizer_id)` table.
- Payment Element (embedded) swap → registration flow's data contract is unchanged; only the `/api/register` response format shifts from `{redirect}` to `{client_secret}`.

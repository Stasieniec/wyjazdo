# wyjazdo.pl

Multi-tenant platform for organizers of trips, retreats, workshops, and group travel events in Poland. Each organizer gets a subdomain (`organizer.wyjazdo.pl`), a public event page, registration with online payment (BLIK, Przelewy24, cards), and a dashboard to manage participants and payouts.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Runtime | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| Auth (organizers) | Clerk |
| Auth (participants) | HMAC-signed magic links (no accounts) |
| Payments | Stripe Checkout + Connect Express (direct charges) |
| Email | Resend |
| Styling | Tailwind CSS |

## Local development

### Prerequisites

- Node.js 22+ (the project uses `fnm` — run `fnm use` if available)
- A Cloudflare account with Workers, D1, and R2 enabled
- A Stripe account with Connect enabled (test mode is fine for dev)
- A Clerk application
- A Resend account with a verified sending domain

### Setup

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill in all values
npm run db:migrate:local          # apply D1 migrations locally
npm run dev                       # starts Next.js dev server with Turbopack
```

### Subdomain routing in dev

Modern browsers resolve `*.localhost` to `127.0.0.1` automatically. Visit `organizer.localhost:3000` to test subdomain routing — no `/etc/hosts` edits needed. `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000` in `.dev.vars`.

### Stripe webhooks in dev

Use the Stripe CLI to forward webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe listen --forward-connect-to localhost:3000/api/stripe/connect-webhook
```

Copy the signing secrets into `.dev.vars` as `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production Next.js build |
| `npm test` | Run Vitest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migration from schema changes |
| `npm run db:migrate:local` | Apply migrations to local D1 |
| `npm run db:migrate:remote` | Apply migrations to production D1 |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` from bindings |
| `npm run preview` | Build + preview on local Workers runtime |
| `npm run deploy` | Build + deploy to Cloudflare Workers |

## Project structure

```
src/
  app/
    dashboard/          Organizer dashboard (Clerk-protected)
      events/           Event CRUD, participant management, CSV export
      finance/          Stripe Connect balance + payouts
      onboarding/       Organizer profile + Stripe Connect setup
      settings/         Edit organizer profile
    sites/[subdomain]/  Public organizer pages (via middleware rewrite)
      [eventSlug]/      Event page, registration form, thanks page
    my-trips/           Participant portal (magic-link auth)
    api/
      register/         POST: create participant + Checkout Session
      stripe/webhook/   Platform Stripe webhook
      stripe/connect-webhook/  Connect Stripe webhook
      cron/             Scheduled handlers (pending cleanup, balance reminders)
  lib/
    db/schema.ts        Drizzle schema (organizers, events, participants, payments)
    db/queries/         One query module per table
    db/migrations/      SQL migrations (applied via wrangler d1)
    participant-status.ts   Derived status from lifecycle + payments
    participant-auth.ts     HMAC tokens + magic-link cookies
    capacity.ts         Spot counting (derived from payments)
    register/           Registration + balance payment helpers
    stripe.ts           Stripe client factory
    stripe-connect.ts   Connect Express account management
    email/              Resend client + templates
    balance-reminders.ts    Reminder window logic
    cron/               Cron job implementations
  middleware.ts         Subdomain detection + Clerk composition
```

## Environment

### Secrets (set via `wrangler secret put` for production, `.dev.vars` for local)

- `CLERK_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` — signing secret for `/api/stripe/webhook`
- `STRIPE_CONNECT_WEBHOOK_SECRET` — signing secret for `/api/stripe/connect-webhook`
- `PARTICIPANT_AUTH_SECRET` — HMAC key for magic-link tokens (`openssl rand -hex 32`)
- `RESEND_API_KEY`
- `CRON_SECRET`

### Public vars (in `wrangler.jsonc`)

- `NEXT_PUBLIC_ROOT_DOMAIN` — `wyjazdo.pl` in prod, `localhost:3000` in dev
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Bindings (in `wrangler.jsonc`)

- `DB` — D1 database
- `R2_IMAGES` — R2 bucket for image uploads
- `ASSETS` — static assets (managed by OpenNext)

### Cron triggers

- `*/10 * * * *` — expire stale pending payments
- `0 8 * * *` — send balance-due reminders (08:00 UTC)

## Deployment

```bash
npm run db:migrate:remote   # apply any pending migrations
npm run deploy              # build + deploy to Cloudflare Workers
```

Requires Cloudflare Workers Paid plan (bundle exceeds 3 MiB free limit).

## Design documents

- [MVP spec](docs/superpowers/specs/2026-04-13-wyjazdo-mvp-design.md) — original product design (partially superseded)
- [Payments/deposits/payouts spec](docs/superpowers/specs/2026-04-15-participants-deposits-payouts-design.md) — current payment architecture

---
name: Pre-launch QA test plan
description: Risk-ordered, go/no-go test plan for catching showstopper bugs before the first organizers touch wyjazdo.pl. Covers all 13 functional areas across localhost (bulk) and wyjazdo.pl (deploy-sensitive pass), desktop with mobile spot-checks.
type: design
---

# Pre-launch QA — wyjazdo.pl

**Date:** 2026-05-02
**Status:** Draft for review.

## 1. Goal

Find showstopper bugs before the first real organizers use the platform. This is a **go/no-go** pass, not a comprehensive test suite. Output is a pass/fail verdict per item plus a triage list of any failures.

The platform is on Stripe and Clerk **test keys** (verified in `wrangler.jsonc`: `pk_test_...` for both). Both localhost and wyjazdo.pl are safe to use real test cards on.

## 2. Scope

All 13 areas from the project specs are in-scope:

1. Organizer signup + onboarding wizard
2. Stripe Connect organizer setup
3. Event create / edit / delete
4. Public event page on subdomain
5. Participant registration + custom questions
6. Stripe Checkout (cards / BLIK / P24)
7. Stripe webhook → participant status
8. Organizer participant management (confirm, refund, message, cancel)
9. Multi-attendee registrations
10. Event photo gallery
11. CSV export
12. Cron jobs (balance reminders, etc.)
13. Organizer settings / profile

**Coverage philosophy:** golden path + 1–3 curated edge cases per area. Not exhaustive.

**Devices:** desktop full pass; mobile (real phone) spot-check on participant registration/payment and organizer dashboard.

**Environments:** localhost first for the bulk; final deploy-sensitive pass on wyjazdo.pl.

## 3. Showstopper bar

**Blocks launch:**
- Money loss: charge without a registration record, refund that doesn't actually refund, payout to wrong account.
- Data loss: registrations vanish; paid participants invisible to organizer.
- Broken core flow: can't sign up / can't onboard / can't create event / can't register / can't pay.
- Multi-tenant leak: organizer A can see or modify organizer B's data.
- 500 on the golden path.

**Doesn't block (log and triage after):**
- Visual polish, copy issues, edge-case UX rough edges, performance.

## 4. Test data

### Accounts
- **Existing organizer** (already onboarded) — used for most tests.
- **Fresh Clerk test user** — created during Phase 1 to exercise the onboarding wizard, and reused as "organizer #2" for the multi-tenant isolation check.

### Stripe test cards
- `4242 4242 4242 4242` — universal success
- `4000 0027 6000 3184` — 3DS-required success
- `4000 0000 0000 0002` — generic decline
- **BLIK:** Stripe Checkout shows the test code on the BLIK page in test mode.
- **Przelewy24:** Stripe test mode redirects to a simulated bank page with succeed/fail buttons.

Any expiry in the future, any 3-digit CVC, any postal code.

### Emails
- Gmail `+tag` style for participant burners (e.g. `you+wyjazdo-test1@gmail.com`).

### Local environment prerequisites
- `npm run dev` (or equivalent) running.
- `stripe listen --forward-to localhost:3000/api/stripe/webhook` running, with the resulting webhook signing secret in `.dev.vars` / `.env.local`.
- D1 local DB writable (existing data preserved).

## 5. Collaboration model

- **Claude drives Playwright** for: in-app forms, dashboard navigation, public pages, multi-tenant checks, anything verifiable via DOM or network log.
- **User drives** for: Stripe-hosted Connect onboarding, Stripe Checkout card entry, Clerk email verification (codes go to user's inbox), and all real-phone mobile checks.
- Each test item is marked **Pass / Fail / Blocked / Skip**. Failures get a one-line note. Failures collected in §11 for triage.

## 6. Phase 1 — Money path *(must all pass before Phase 2)*

If any item here fails as a showstopper, stop and fix before continuing.

| # | Test | Driver |
|---|---|---|
| 1.1 | Sign up fresh Clerk test user → redirected to `/onboarding` | Claude + User (email code) |
| 1.2 | Complete onboarding wizard end-to-end: welcome → displayName → subdomain (live preview, slug validation) → contactEmail → description (optional) → consents (accept-all helper works) → submit | Claude |
| 1.3 | Lands on dashboard; organizer row exists; public subdomain renders an empty profile | Claude |
| 1.4 | Connect Stripe in test mode; return to dashboard shows payouts-enabled state | User |
| 1.5 | Create new event: title, auto-suggested slug, dates, capacity, **price in PLN** (verify ZlotyInput accepts PLN, not grosze), deposit, at least 2 custom questions of different types | Claude |
| 1.6 | Publish event; public event page renders title, dates, price, description, all custom questions | Claude |
| 1.7 | In incognito, visit event on subdomain → click register → fill form including custom answers | Claude |
| 1.8 | Submit registration → redirected to Stripe Checkout → pay with `4242…` | User |
| 1.9 | Lands on `/thanks` with success state | Claude |
| 1.10 | Dashboard shows participant as confirmed/paid; payment row exists with correct amount; capacity decremented by 1 | Claude |
| 1.11 | Confirmation email sent to participant (per current spec) | User (inbox check) |

### Phase 1 edge cases (must pass)

| # | Test |
|---|---|
| 1.E1 | Capacity full: register up to capacity, attempt one more → behavior matches spec (waitlist or rejection) |
| 1.E2 | Double-submit registration form → atomic dedupe holds (commit `7f677b2`); only one participant created |
| 1.E3 | Checkout abandoned (close tab during Stripe checkout): no zombie confirmed participant; pending row either absent or cleaned up by cron |

## 7. Phase 2 — Organizer participant management

| # | Test |
|---|---|
| 2.1 | Confirm a pending participant manually from dashboard |
| 2.2 | Issue full refund on a paid participant → status updates; payment row reflects refund; organizer balance adjusts |
| 2.3 | Send a message to participant (if shipped per current build) |
| 2.4 | Cancel a participant |
| 2.5 | Multi-attendee registration: one payer registers N attendees in a single Checkout |
| 2.6 | Resend confirmation email action |
| 2.7 | Edit event after registrations exist: confirm what's allowed (price change? capacity?) and what's blocked |

### Phase 2 edge cases

| # | Test |
|---|---|
| 2.E1 | Try to delete event with paid participants → refused or strong warning |
| 2.E2 | Refund of a deposit-only payment behaves correctly |

## 8. Phase 3 — Secondary flows + mobile spot-checks

| # | Test |
|---|---|
| 3.1 | CSV export: file downloads; columns correct; custom answers included; Polish diacritics not mangled |
| 3.2 | Photo gallery: upload images; appear on public event page; ordering correct |
| 3.3 | Settings: edit displayName, contactEmail, description; verify subdomain rename behavior (locked or guarded) |
| 3.4 | Public organizer profile lists all published events correctly |
| 3.5 | **Multi-tenant isolation:** log in as Phase 1's fresh organizer; confirm zero visibility of original organizer's events, participants, payments. Try direct URL access to other organizer's resources by ID — expect 404/403. |
| 3.M1 | **Mobile (real phone):** participant flow — event page → register → pay |
| 3.M2 | **Mobile (real phone):** organizer dashboard — events list, edit event, participant table all usable |

## 9. Phase 4 — Deploy-sensitive pass on wyjazdo.pl

After all of Phases 1–3 pass on localhost, run this confirmation pass on the deployed env. Most flows already proven; this pass focuses on what only fails in production.

| # | Test |
|---|---|
| 4.1 | Real subdomain DNS resolves: visit `<subdomain>.wyjazdo.pl` → renders correctly |
| 4.2 | Clerk redirects work with prod domain (sign-in/sign-up redirects don't break) |
| 4.3 | Stripe webhook hits the deployed endpoint: trigger one test payment, verify delivery in Stripe Dashboard → Webhooks |
| 4.4 | R2 image paths render in production (event photos, organizer avatar if applicable) |
| 4.5 | Cron jobs visible in Cloudflare Workers dashboard and have run on schedule (check observability logs) |
| 4.6 | One full end-to-end cycle on prod: register → Checkout → webhook → confirmed participant in dashboard |

## 10. Phase 5 — Edge-case bundle

Run after Phase 4. These are the edge cases not tied to a single phase.

| # | Test |
|---|---|
| 5.1 | Expired Clerk session mid-flow (e.g., during event edit) — graceful re-auth, no data loss |
| 5.2 | Custom answers with very long input / unicode / Polish diacritics — stored and displayed correctly |
| 5.3 | Capacity race: with N−1 spots open, attempt to submit N concurrent registrations — capacity holds |
| 5.4 | Slug collision: try to create event with a slug that already exists for the same organizer → blocked or auto-suffixed |
| 5.5 | Stale form: open registration form, organizer changes price, participant submits → either re-priced at server or refused, never charged old amount |

## 11. Failure log

Failures recorded here as we go. Format:

```
- [Phase X.Y] Short title — what happened — severity (showstopper / non-blocking) — owner
```

(empty until execution begins)

## 12. Exit criteria

**Ship to first users when:**
- All Phase 1 items pass (golden + edge).
- All Phase 2 items pass (golden + edge).
- All Phase 3 multi-tenant items pass (3.5).
- All Phase 4 items pass on wyjazdo.pl.
- No showstopper-severity failures open.

**Acceptable to ship with open issues:** non-blocking findings in §11, gallery/CSV/mobile-cosmetic bugs, Phase 5 edge cases that are rare and have clear workarounds.

# wyjazdo.pl — Participants, Deposits, and Payouts

**Date:** 2026-04-15
**Status:** Approved (pending written-spec review)
**Supersedes fragments of:** `2026-04-13-wyjazdo-mvp-design.md` (participants status set, single-payment flow, extension points for multi-phase payments, refunds, and payouts)

## 1. Product summary

Three interconnected design decisions that shape the next phase after the initial MVP:

1. **Participant experience.** Participants do not create accounts. They interact through signed links in transactional emails and an optional "my trips" page reached by a request-link flow.
2. **Two-phase payments.** Organizers can require a deposit (zaliczka) at registration time with the balance due by a deadline. Both phases use Stripe Checkout (no off-session charges — BLIK and P24 don't support them).
3. **Organizer payouts.** Organizers onboard through Stripe Connect Express with a manual payout schedule. Funds live in the organizer's connected balance; the organizer triggers payouts when they want. The platform never holds other people's money.

These three decisions are interdependent. The balance-payment UX (topic 2) only works if there is a low-friction participant surface (topic 1). The payout model (topic 3) dictates who is the merchant of record and therefore what the Checkout Session looks like in topic 2.

## 2. Participant experience

### 2.1 Authentication model

No passwords. Two no-password mechanisms coexist:

**Per-resource signed token (primary).** Every transactional email we send contains a link of the form `wyjazdo.pl/my-trips/<participant_id>?t=<hmac-token>`. The token is `HMAC_SHA256(secret, "pt:" + participant_id)`. It is long-lived (no expiry in MVP) and requires no database lookup to validate. Clicking it opens that participant's trip page directly. This mechanism is what makes the "pay your balance" email a one-click experience.

**Request-link flow (secondary).** `wyjazdo.pl/my-trips` asks for an email, sends a short-lived magic link (`ttl = 15 min`) whose click sets a signed HTTP-only cookie (`wyjazdo_participant_email`, valid 30 days). The cookie is a signed envelope `{ email, issued_at }` signed with HMAC. Wholesale invalidation (if ever needed) is achieved by rotating the HMAC secret; for MVP there is no per-email revocation mechanism — the 30-day TTL is the only expiry. While the cookie is present and signature-valid, `wyjazdo.pl/my-trips` lists every registration whose `email` matches.

### 2.2 Page scope

`GET /my-trips/<participant_id>` (always available with a valid token; also available via email-cookie session when that email matches):
- Event title, organizer name, dates, location
- The participant's submitted answers (read-only)
- Payment status panel:
  - For single-payment events: status and paid-at or "Pay now" CTA
  - For deposit-balance events: deposit status, balance amount, balance due date, "Pay balance" CTA when applicable
- "Contact organizer" mailto-link to the organizer's `contact_email`

`GET /my-trips` (requires email-cookie session):
- Index of all registrations under that email across all organizers
- Each row links to its `/my-trips/<id>` page

### 2.3 Explicitly excluded in this phase

- Editing submitted answers after registration
- Downloading organizer-uploaded documents
- Self-serve cancellation (contact organizer instead)
- Chat or messaging with organizer
- Following organizers or cross-organizer discovery
- Profile prefill for faster re-registration

### 2.4 Email channel

Resend (already in the stack) sends: registration confirmation, deposit receipt, balance-due reminders at T-14d / T-3d / T-0, balance paid receipt, magic-link sign-in link. Every email except the magic-link one contains the per-participant signed token; the magic-link email contains a short-lived one-time token instead.

## 3. Two-phase payments

### 3.1 Event configuration

Two new columns on `events`:

| Column | Type | Meaning |
|---|---|---|
| `deposit_cents` | integer, nullable | Absolute deposit amount in grosze. `NULL` or equal to `price_cents` means single-payment. |
| `balance_due_at` | integer, nullable | Unix milliseconds. Required when `deposit_cents < price_cents`, otherwise `NULL`. |

The event editor enforces: `deposit_cents` in `(0, price_cents]`; when `deposit_cents < price_cents`, `balance_due_at` is required and must fall before `starts_at`.

### 3.2 `payments` table

```
id                        text PRIMARY KEY                 -- ulid
participant_id            text NOT NULL REFERENCES participants(id)
kind                      text NOT NULL                    -- 'full' | 'deposit' | 'balance'
amount_cents              integer NOT NULL
currency                  text NOT NULL DEFAULT 'PLN'
status                    text NOT NULL                    -- 'pending' | 'succeeded' | 'expired' | 'failed' | 'refunded'
due_at                    integer                          -- null for 'full' and 'deposit'; set for 'balance'
stripe_session_id         text
stripe_payment_intent_id  text
stripe_application_fee    integer                          -- platform cut recorded at payment time (0 for MVP)
last_reminder_at          integer                          -- for balance payments; null otherwise
paid_at                   integer
expires_at                integer                          -- pending TTL; deposit=30 min, balance=24 h
created_at                integer NOT NULL
updated_at                integer NOT NULL
INDEX payments_participant_idx        ON payments(participant_id)
INDEX payments_stripe_session_idx     ON payments(stripe_session_id)
INDEX payments_status_due_idx         ON payments(status, due_at)
```

At most one non-expired row per `(participant_id, kind)` at any time. When a pending row expires, it stays in the table with `status='expired'` for audit and a fresh pending row is created on the next attempt.

### 3.3 Participant lifecycle

`participants.status` (renamed to `lifecycle_status` for clarity) shrinks to the states that are NOT derivable from payments: `active` and `waitlisted` and `cancelled`. All payment-related states (`pending`, `paid`, `deposit_paid`, `overdue`, `refunded`) become derived.

Derivation function `derivedStatus(participant, payments)`:

1. If `lifecycle_status = 'waitlisted'` → `waitlisted` (regardless of payments; a waitlisted person has no payment rows in practice).
2. If `lifecycle_status = 'cancelled'` → `cancelled`.
3. Otherwise compute from payments:
   - No payments, or all payments in `{expired, failed}` → `cancelled`
   - Any payment in `{pending}` → `pending`
   - One `full` with `status='succeeded'` → `paid`
   - `deposit` succeeded + `balance` succeeded → `paid`
   - `deposit` succeeded, no `balance` row → `deposit_paid`
   - `deposit` succeeded, `balance` row in `pending` → `deposit_paid`
   - `deposit` succeeded, `balance` row in `expired`/`failed` with `balance.due_at <= now()` → `overdue`
   - Any `refunded` payment → `refunded` (terminal for display purposes)

Implemented in `src/lib/participant-status.ts` with pure-function unit tests. Dashboard queries either join and compute in SQL or call the function in TS after a join.

### 3.4 Registration flow

Single-payment events (unchanged except for the `payments` row):

1. Form submitted → `POST /api/register`.
2. Zod-validate input, load event, run capacity check.
3. Insert `participants` (`lifecycle_status='active'`).
4. Insert `payments` (`kind='full'`, `amount_cents = price_cents`, `status='pending'`, `expires_at = now + 30 min`).
5. Create Checkout Session on the organizer's connected account; store `stripe_session_id` on the payment row.
6. Redirect to Stripe.
7. Webhook `checkout.session.completed` → mark the `payments` row succeeded.

Deposit-balance events (new):

1–3. Same as above, but step 4 creates `payments` with `kind='deposit'`, `amount_cents = deposit_cents`.
5–7. Same as above, but amount is `deposit_cents`.
8. No balance row is created yet. It is created lazily when the first balance reminder fires OR when the participant clicks "Pay balance" on their trip page (whichever happens first).

### 3.5 Balance flow

**Reminder cron.** A Cloudflare Cron Trigger runs nightly at 08:00 Europe/Warsaw. Pseudocode:

```
for each participant whose derived status is 'deposit_paid':
  let e = participant.event
  if e.balance_due_at in { now + 14d ± 1d, now + 3d ± 12h, now ± 12h }:
    ensure a pending balance payments row exists
    if payment.last_reminder_at is today: skip
    send reminder email with signed per-trip link
    set payment.last_reminder_at = now()
```

Windows are intentionally loose so a missed nightly run doesn't skip a reminder.

**Balance payment creation.** When a balance row needs to exist and does not, or the existing one is expired/failed:

1. Insert `payments` (`kind='balance'`, `amount_cents = price_cents - deposit_cents`, `status='pending'`, `due_at = event.balance_due_at` at the event level OR the per-participant extension — see §3.6, `expires_at = now + 24h`).
2. Create Checkout Session on the connected account.
3. Embed the Session URL in the reminder email (or return it to the "Pay balance" click handler).
4. Webhook `checkout.session.completed` → mark succeeded.

**Stale pending balance rows.** The 24-hour `expires_at` applies; cron `*/10 * * * *` (already present for deposit cleanup) also handles balance pendings. Expired rows stay in the table with `status='expired'`.

### 3.6 Overdue handling

When a participant's derived status is `overdue`:

- They appear in the "Overdue" bucket of the organizer's event dashboard.
- The spot is still considered taken for capacity (see §3.7).
- Organizer has two actions on the participant row:
  1. **Extend deadline.** Edit the per-participant balance `due_at`. This is stored on the `payments` row (not on `events`) so per-participant extensions are possible. The next reminder cron run picks up the new date.
  2. **Cancel & free spot.** Flips `participants.lifecycle_status` to `cancelled`. If the organizer wants to refund the deposit, they do so in their Stripe Express dashboard; our webhook handles `charge.refunded` and marks the payment `refunded` automatically.

No auto-cancellation. Cancelling someone is a social and sometimes financial decision; a human signs it.

### 3.7 Capacity

Current rule: count participants where `status='paid' OR (status='pending' AND expires_at > now)`.

New rule: count participants whose derived status is in `{pending, deposit_paid, paid, overdue}`. `waitlisted`, `cancelled`, `refunded` don't count. `deposit_paid` is the important one — a paid deposit holds the spot indefinitely, including after the balance becomes `overdue`, until the organizer cancels.

Implementation: a single SQL expression that joins `participants` to `payments` and applies the same rules as the TS derivation. Lives in `src/lib/capacity.ts`.

## 4. Organizer payouts (Stripe Connect Express)

### 4.1 Why Connect, not manual bank transfers

Collecting payments and remitting them to third parties is regulated payment-institution activity under PSD2 in the EU. Stripe's own Terms of Service forbid using a standard Stripe account to collect money on behalf of third parties ("money transmission"). Chargebacks hit the account that took the money, so an aggregator model exposes the platform to direct financial loss. Connect exists specifically to delegate all of this to Stripe while preserving a good organizer UX.

### 4.2 Onboarding

New columns on `organizers`:

| Column | Type | Meaning |
|---|---|---|
| `stripe_account_id` | text, nullable | `acct_...` on connected account |
| `stripe_onboarding_complete` | integer | 0/1 mirroring `details_submitted` AND `charges_enabled` |
| `stripe_payouts_enabled` | integer | 0/1 mirroring `payouts_enabled` |
| `stripe_account_synced_at` | integer | last reconcile |

Flow:

1. Existing `/dashboard/onboarding` (subdomain + profile) runs unchanged.
2. New step: `/dashboard/onboarding/payouts`. Button "Connect Stripe". Server action:
   - Creates a Stripe Account with `type='express'`, `country='PL'`, `capabilities: { card_payments, transfers, blik_payments, p24_payments }`, `settings.payouts.schedule.interval='manual'`.
   - Stores `stripe_account_id` on the organizer row.
   - Creates an Account Link (`type='account_onboarding'`).
   - Redirects to Stripe.
3. Stripe returns to `/dashboard/onboarding/payouts/return`. We re-fetch the account and write `stripe_onboarding_complete` and `stripe_payouts_enabled`.
4. If not complete, the return page shows "Stripe needs more info" with a fresh Account Link button.

State mirroring is also driven by the `account.updated` Connect webhook so changes that happen outside our UI (e.g., Stripe requesting additional info later) are picked up without the organizer having to re-visit anything.

### 4.3 Hard gate on publish

`events.status` may only transition to `published` when `organizers.stripe_onboarding_complete = 1 AND stripe_payouts_enabled = 1`. The "Publish" button on the event editor is disabled otherwise with a link to finish Stripe setup.

Draft events do not require Stripe setup. This lets organizers draft an event first, do Stripe onboarding in parallel, and publish when both are ready.

### 4.4 Checkout Sessions — direct charges

Every Checkout Session we create (for any `payments.kind`) uses direct charges on the connected account. The Session is created **on** the connected account by passing `{ stripeAccount }` — not with `transfer_data.destination` (which would be destination charges on the platform account):

```ts
stripe.checkout.sessions.create(
  {
    // ...existing fields (line_items, customer_email, metadata, success_url, cancel_url)...
    payment_intent_data: {
      application_fee_amount: 0, // MVP: platform takes nothing
    },
  },
  { stripeAccount: organizer.stripe_account_id },
);
```

Direct charges mean the charge is created directly on the connected account and the organizer is the merchant of record on the receipt. This is the correct posture for VAT and accounting: the organizer is the actual seller, not the platform. Webhook events for these Sessions arrive via the Connect webhook endpoint (see §4.7). When we add a platform fee, `application_fee_amount` becomes non-zero; no other code needs to change.

### 4.5 Manual payouts

`settings.payouts.schedule.interval = 'manual'` means funds stay in the organizer's connected balance until the organizer initiates a payout.

Two surfaces:

1. **Finance tab** ([src/app/dashboard/finance](src/app/dashboard/finance/)) — displays available and pending balance, recent payouts (fetched per request via `stripe.balance.retrieve` and `stripe.payouts.list`, cached briefly). Primary CTA "Pay out to my bank" → server action → `stripe.payouts.create({}, { stripeAccount })`. Confirmation view links to the payout detail page.
2. **Link to Stripe Express Dashboard** — `stripe.accounts.createLoginLink(stripe_account_id)` returns a one-time login URL to Stripe's hosted Express Dashboard, where the organizer can review detailed transaction history, update bank details, issue refunds, and handle disputes.

### 4.6 Refunds

Out of scope for in-app UI in this phase. Organizers issue refunds from their Stripe Express Dashboard. When they do, Stripe fires `charge.refunded` on the Connect webhook; our handler finds the `payments` row by `stripe_payment_intent_id` and sets `status='refunded'`. Derived participant status updates accordingly.

### 4.7 Webhooks

Two endpoints:

**`/api/stripe/webhook`** (platform endpoint, existing) handles events on platform-owned Sessions. With direct charges, the bulk of `checkout.session.completed` / `session.expired` / `payment_intent.payment_failed` events arrive on the **Connect** endpoint instead (they originate from the connected account). The platform endpoint remains for any platform-level events we might add later.

**`/api/stripe/connect-webhook`** (new) subscribes to Connect-forwarded events:

- `account.updated` → reconcile `stripe_onboarding_complete` and `stripe_payouts_enabled` on `organizers`.
- `checkout.session.completed` / `session.expired` / `payment_intent.payment_failed` → find `payments` row by `stripe_session_id` (from `metadata.payment_id` as a fallback) and update status. Identical logic to the current webhook handler.
- `charge.refunded` → find `payments` row by `stripe_payment_intent_id`, mark `refunded`.
- `payout.paid` / `payout.failed` → optional UX polish for the Finance tab (can be deferred).

Both endpoints verify the Stripe signature with their respective secrets. Signature verification uses `stripe.webhooks.constructEventAsync` (required on Workers).

### 4.8 Platform fee posture

MVP: `application_fee_amount: 0`. When ready to monetize, add `platform_fee_bps INTEGER DEFAULT 0` on `organizers` and compute the fee per Session. No schema churn required to ship MVP.

## 5. Schema changes summary

### 5.1 Altered tables

**`organizers`** — add columns:
- `stripe_account_id TEXT`
- `stripe_onboarding_complete INTEGER DEFAULT 0`
- `stripe_payouts_enabled INTEGER DEFAULT 0`
- `stripe_account_synced_at INTEGER`

**`events`** — add columns:
- `deposit_cents INTEGER`
- `balance_due_at INTEGER`

**`participants`** — rename `status` to `lifecycle_status`, restrict values to `{active, waitlisted, cancelled}`. Drop the following columns (now lived on `payments`):
- `stripe_session_id`
- `stripe_payment_intent_id`
- `amount_paid_cents`
- `paid_at`
- `expires_at`

No new auth-related columns on `participants` — the magic-link cookie is self-contained (HMAC-signed, email-scoped) and does not reference any per-participant row. Secret rotation handles wholesale invalidation if ever needed.

Migration notes: this project is pre-production, so an in-place schema change with a drop-and-recreate of `participants` (preserving the surviving columns) is acceptable. No backfill of existing participants is required.

### 5.2 New tables

**`payments`** — as defined in §3.2.

### 5.3 No new session/auth tables

The participant "session" is an HMAC-signed cookie. No DB rows for participant sessions.

## 6. Error handling

- **Stripe onboarding incomplete at payment time** — prevented by the publish gate. If regression occurs, `/api/register` returns a structured error and the event page shows "Registrations temporarily unavailable".
- **Balance Checkout Session expires mid-flow** — webhook marks `payments.status='expired'`; next reminder or "Pay balance" click creates a fresh session.
- **`account.updated` for an unknown `stripe_account_id`** — log and return 200.
- **Magic-link HMAC verify fails** — render "link invalid" page with "request a new link" CTA.
- **Cookie session for an email with no matching participants** — `/my-trips` renders an empty state, not an error.
- **Refund webhook for a `payments` row already `refunded`** — idempotent no-op.
- **Capacity race at deposit time** — unchanged from the MVP spec; 30-min pending windows make practical oversell vanishingly rare.
- **Webhook re-delivery** — all handlers are idempotent (`WHERE status='pending'` guards on updates, plus status-specific early returns).

## 7. Testing strategy

Additions on top of the MVP testing strategy:

- Unit tests for `derivedStatus(participant, payments)` over arbitrary payment permutations (deposit+balance, full, expired, refunded, mixed).
- Unit tests for HMAC signed-token encode / decode and tamper rejection.
- Unit tests for the balance-reminder selection logic: correct window membership, idempotent `last_reminder_at`, extension respected.
- Webhook tests extended with fixtures for Connect `account.updated` and `charge.refunded` events.
- Manual end-to-end: deposit → reminder fires → balance paid → participant becomes `paid`, against Stripe test mode with a test Connect account.

## 8. Explicit non-goals for this phase

- No auto-cancel of overdue balances. Organizer decides.
- No in-app refund UI. Organizers refund via Stripe Express dashboard.
- No self-serve participant cancellation. Contact organizer.
- No participant profile prefill across registrations.
- No platform fee. `application_fee_amount = 0`.
- No multi-currency. PLN only.
- No BLIK/P24 auto-charge for balance. Not technically possible; participant always clicks a payment link.
- No in-app document delivery (itineraries, packing lists). Organizer emails these out-of-band.
- No chat or messaging between organizers and participants.

## 9. Extension points (explicit, for later)

- **Platform fee.** Add `organizers.platform_fee_bps INTEGER DEFAULT 0`; compute `application_fee_amount` per Session.
- **Refund UI.** Add `POST /dashboard/events/[id]/participants/[pid]/refund` that hits `stripe.refunds.create` on the connected account; webhook handler already in place.
- **Multi-installment payments.** `payments.kind` already includes `'deposit'` and `'balance'`; add `'installment'` with an `installment_index` column.
- **Self-serve cancellation.** A "cancel my spot" action on the trip page creates a cancellation request row; organizer approves or auto-approve under a policy.
- **Document delivery.** Add a `documents` table keyed by `event_id`; surface on `/my-trips/<id>`.
- **Participant accounts (if ever needed).** Upgrade magic-link to a real Clerk participant auth; the `participants.email` column is already the natural join key.

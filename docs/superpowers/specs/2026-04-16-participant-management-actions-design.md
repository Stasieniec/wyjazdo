# Participant Management Actions for Organizers

**Date:** 2026-04-16
**Status:** Draft

## Goal

Give organizers a practical set of action buttons in the participant table to manage registrations — cancel anyone, promote from waitlist, extend deadlines, and resend payment links. The system should be simple, not overcomplicated, and cover typical organizer needs.

## Existing State

The organizer dashboard at `src/app/dashboard/events/[id]/page.tsx` shows a participants table with two tabs: active participants and waitlisted participants. Currently only two actions exist:

- **Przedłuż termin** — extend balance deadline (overdue participants only)
- **Anuluj i zwolnij miejsce** — cancel participant (overdue participants only)

Participants have a lifecycle status (`active`, `waitlisted`, `cancelled`) and a derived status computed from lifecycle + payment state (`pending`, `paid`, `deposit_paid`, `overdue`, `refunded`, `cancelled`, `waitlisted`).

## Action Buttons

### 1. Cancel Participant (Anuluj)

**Visible when:** Any derived status except `cancelled` and `refunded`.

**Behavior:**

- Sets `lifecycleStatus` to `cancelled` regardless of current lifecycle status (both `active` and `waitlisted`)
- No automatic Stripe refund — organizer handles refunds manually via Stripe dashboard
- Confirmation dialog adapts based on payment state:
  - **Has paid** (derived: `paid`, `deposit_paid`, `overdue`): "Czy na pewno chcesz anulować uczestnika {name}? Uczestnik dokonał płatności — zwrot środków należy wykonać ręcznie przez panel Stripe."
  - **Has not paid** (derived: `pending`, `waitlisted`): "Czy na pewno chcesz anulować uczestnika {name}?"
- Uses `window.confirm()` — consistent with existing UI

**Changes required:**

- Modify `cancelParticipant()` in `src/lib/db/queries/participants.ts` to remove the `lifecycleStatus = "active"` guard, allowing cancellation from `waitlisted` too
- Rename `cancelAndFreeSpotAction` → `cancelParticipantAction` in `src/app/dashboard/events/[id]/actions.ts`
- Update `ParticipantsTable.tsx` to show the cancel button for all non-terminal statuses with contextual confirm messages

### 2. Promote from Waitlist (Przenieś z listy rezerwowej)

**Visible when:** Derived status is `waitlisted`.

**UI:** Inline form in the actions cell (same pattern as "Przedłuż termin") with:
- A `datetime-local` input for the payment link expiry
- A submit button labeled "Przenieś z listy"

**Behavior:**

1. Validate participant is `waitlisted` and event belongs to organizer
2. Check capacity — if no spots available, return an error (race condition guard)
3. Set `lifecycleStatus` from `waitlisted` → `active` (new query: `activateWaitlistedParticipant`)
4. Create a payment record (`full` or `deposit` based on event config, same logic as `process-registration.ts`)
5. Create a Stripe Checkout Session with the organizer-chosen expiry time
6. Email the participant a payment link
7. Revalidate dashboard

**New DB query:** `activateWaitlistedParticipant(id)` — sets lifecycle to `active` only if currently `waitlisted`.

**New email — "Zwolniło się miejsce":**
- Subject: `Zwolniło się miejsce — {eventTitle}`
- Body: Powitanie z imieniem uczestnika, informacja o przeniesieniu z listy rezerwowej, przycisk z linkiem do płatności, termin ważności linku ("Link ważny do {expiryDate}"), szczegóły wydarzenia (tytuł, data, miejsce), nazwa organizatora
- Uses same HTML structure and `safeSend` pattern as existing templates

### 3. Resend Payment Link (Wyślij ponownie link do płatności)

**Visible when:** Participant's `lifecycleStatus` is `active` and they have no succeeded payments. This covers:
- Normal registrations where the 30-min Stripe session expired before payment (derived status falls to catch-all `cancelled` even though lifecycle is still `active`)
- Promoted waitlist participants whose payment link expired
- Active participants with a still-valid pending payment (organizer wants to resend the email)

Note: We cannot rely on derived status alone here because when a Stripe session expires and the payment is marked `expired`, `derivedStatus()` falls through to the catch-all `return "cancelled"` — even though the participant was never actually cancelled by the organizer. Checking `lifecycleStatus === "active"` + no succeeded payments catches all cases correctly.

**Behavior:**

1. Find the participant's relevant payment record (latest `pending` or `expired` payment)
2. If payment status is `expired`, reset it to `pending`
3. Create a fresh Stripe Checkout Session (30-minute expiry)
4. Update payment record with new `stripeSessionId` and `expiresAt`
5. Email participant the new payment link
6. Revalidate dashboard

**New email — "Nowy link do płatności":**
- Subject: `Nowy link do płatności — {eventTitle}`
- Body: Powitanie z imieniem uczestnika, informacja o nowym linku do płatności, przycisk z linkiem, informacja o 30-minutowym terminie ważności, szczegóły wydarzenia, nazwa organizatora
- Uses same HTML structure and `safeSend` pattern as existing templates

### 4. Extend Balance Deadline (Przedłuż termin)

Already implemented. No changes needed. Continues to show for `overdue` participants with a balance payment.

## Action Visibility Matrix

| Derived Status | Anuluj | Przenieś z listy | Przedłuż termin | Wyślij link |
|---|---|---|---|---|
| `paid` | Yes | — | — | — |
| `deposit_paid` | Yes | — | If balance exists | — |
| `overdue` | Yes | — | Yes | — |
| `pending` | Yes | — | — | Yes |
| active lifecycle, no succeeded payments | Yes | — | — | Yes |
| `waitlisted` | Yes | Yes | — | — |
| `cancelled` | — | — | — | — |
| `refunded` | — | — | — | — |

## Files to Modify

- `src/lib/db/queries/participants.ts` — remove `active`-only guard from `cancelParticipant()`, add `activateWaitlistedParticipant()`
- `src/app/dashboard/events/[id]/actions.ts` — rename cancel action, add `promoteFromWaitlistAction`, add `resendPaymentLinkAction`
- `src/components/dashboard/ParticipantsTable.tsx` — update action buttons to show contextually per derived status
- `src/lib/email/send.ts` — add `sendWaitlistPromoted()` and `sendResendPaymentLink()` functions
- `src/lib/email/templates.ts` — add `waitlistPromotedSubject`, `waitlistPromotedHtml`, `resendPaymentLinkSubject`, `resendPaymentLinkHtml`

## Language

All user-facing content (button labels, confirmation dialogs, email templates, error messages) is in Polish, consistent with the rest of the codebase.

## Out of Scope

- Automatic Stripe refunds — organizer handles via Stripe dashboard
- Manual participant creation (adding someone by hand)
- Editing participant details
- Demoting active participants back to waitlist
- Custom modal components — uses `window.confirm()` and inline forms

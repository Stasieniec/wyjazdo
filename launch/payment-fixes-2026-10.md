# Payment and registration fixes, October 2026

Fixes for the bugs found in the 2026-10-19 audit. For each one: what was
wrong, what changed, and a short check you can do later in Stripe test mode.

## Before you deploy

1. Apply the new migration to the remote database first:
   `npm run db:migrate:remote` (adds `0007_payment_fixes.sql`). The new code
   reads the new columns, so deploying the code without the migration breaks
   the site.
2. Optional, in the Stripe dashboard: add `checkout.session.async_payment_succeeded`
   and `checkout.session.async_payment_failed` to both webhook endpoints (the
   platform one and the Connect one). BLIK and Przelewy24 do not need them
   today (see bug 15), but the code handles them if a delayed method is ever
   enabled.

Test setup used below: an event with 4 places, price 1480 zł, deposit 500 zł
per person, balance due date a few weeks ahead, unless a check says otherwise.
Stripe test card `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is
declined. "Two-person registration" means a pair on one form.

## The capacity rule (used by several fixes)

A participant holds a place when they are active (not cancelled, not on the
waitlist), nothing was fully refunded, and they have either a successful
payment or a checkout that can still be paid (not past its expiry time).
This rule lives in `holdsPlace` (src/lib/participant-status.ts) and the same
rule in SQL in `takenSeatsSql` (src/lib/capacity.ts). Both the public "free
places" counter and every admission check (registration, waitlist
promotion, re-opening a lapsed checkout) use it.

## 1. Abandoned checkouts held places forever

**Wrong:** the registration check counted every active participant,
including people who opened a checkout and walked away. The public page
used a different rule, so it showed free places while new guests silently
went to the waitlist.

**Changed:** both now use the single rule above. When a checkout expires the
participant stops holding a place, immediately, without waiting for the
cleanup cron. The cron still marks lapsed payments as expired.

**Check:** set capacity to 2. Register a pair, close the Stripe page without
paying. The event page shows 0 free places. Wait 30 minutes (or expire the
session in the Stripe dashboard). The event page shows 2 free places and a
new pair can register and gets a checkout, not the waitlist.

## 2. A declined card followed by a successful retry ended as "failed"

**Wrong:** a declined attempt marked the payment failed, and the later
success was ignored because only pending rows could become paid. Same when
the payment arrived after the cron had expired the hold. Money was taken,
the guest showed as cancelled and got no confirmation.

**Changed:** a declined attempt inside Checkout no longer changes anything
(the guest can retry until the checkout expires). A success now wins over
pending, failed and expired (not refunded). If the guest had lost their
place in the meantime they get it back; if that overbooks the event, the
payment is still recorded, the guest still gets a confirmation, and the
organizer gets an email and a yellow "needs attention" note on the
participant in the dashboard ("Oznacz jako załatwione" clears it).

**Check:** register, pay with the declined card, then with `4242...` in the
same checkout. The participant shows as deposit paid and a confirmation
email arrives. For the late case: capacity 2, register a pair, leave the
checkout open, in the database set that payment's `expires_at` to the past,
register another pair and pay, then pay the first checkout. The first pair
shows paid with a "needs attention" note and the organizer gets an email.

## 3. Double charges from a second checkout

**Wrong:** "Wyślij link do płatności" created a new checkout while the old
one could still be paid, both tied to the same payment. The balance button
only reused an "open" checkout, so a just-paid one whose webhook had not
arrived got a second checkout.

**Changed:** before creating a new checkout the old one is expired in
Stripe. If the old one turns out to be already paid, no new checkout is
created and the user sees "Płatność jest w trakcie przetwarzania".

**Check:** register, do not pay. In the dashboard click "Wyślij link do
płatności". Open the first checkout link: Stripe says it has expired. The
new link from the email works. Paying it shows deposit paid once.

## 4. A group could be counted as one seat (race)

**Wrong:** the participant row and its attendee rows were written in
separate steps, so for a moment a party of four counted as one seat.

**Changed:** participant, attendees and the first payment row are written
in one database batch (one transaction), guarded by the capacity check.

**Check:** capacity 4 with one paid single. Register two pairs at the same
time from two browsers. One pair gets a checkout, the other lands on the
waitlist. The dashboard never shows 5 people holding places.

## 5. Waitlist promotion overbooked and leaked places

**Wrong:** the promotion check ignored party size and was not atomic, and
the participant was set active before Stripe was called, so a Stripe error
left them active with nothing to pay.

**Changed:** the whole party must fit; activation and the payment row
happen in one batch; if creating the checkout fails, the participant goes
back to the waitlist. The link expiry must be between 30 minutes and 24
hours (Stripe's limits).

**Check:** capacity 3, one paid pair, a waitlisted pair. "Przenieś z listy"
fails (no capacity). Cancel the paid pair, try again: it works and the
promoted pair gets an email with a payment link for 2 x 500 zł.

## 6. Wrong balance amount

**Wrong:** balance = total minus (current deposit per person x current
number of people). Changing the deposit or price later, or removing a
person, gave the wrong amount.

**Changed:** balance = registration total minus what was actually paid
(net of partial refunds). Each attendee row now stores the price they
registered at, so later price edits do not change what existing guests
owe. Older registrations without a stored price fall back to the current
price.

**Check:** register a pair, pay the deposit (1000 zł). Change the deposit to
600 and the price to 1580. On the guest's trip page click "Opłać dopłatę":
the checkout asks for 1960 zł (2960 minus 1000).

## 7. Registering after the balance due date only charged the deposit

**Changed:** if the balance due date has passed, the registration charges
the full amount up front.

**Check:** set the balance due date to yesterday, register: the checkout is
for 1480 zł and is labelled with the event title, not "Zaliczka".

## 8. Times shifted by 1 to 2 hours

**Wrong:** the section editor, deadline extension and waitlist promotion
sent times like `2026-11-13T17:30`, which the server (running in UTC) read
as UTC. Server-rendered dates (emails, my-trips, reminders) were formatted
in UTC too.

**Changed:** the section editor now converts to a full timestamp in the
browser before sending, like the creation wizard. On the server, a bare
date-time is read as Warsaw time (summer and winter time handled). Dates in
emails, my-trips, the thanks page, the reminder email and the dashboard are
formatted in Europe/Warsaw.

**Check:** in the event editor set the start to 17:30 and save. Reload: it
still says 17:30. The confirmation email and the trip page show the same
date. Do it for a date after the end of October too (winter time).

## 9. Emails

**Wrong:** Resend reports errors in its return value, not by throwing, so
failures were never logged. Several sends were fire-and-forget and could be
dropped when the Worker finished the request. Names went into email HTML
unescaped. Replies went to no-reply@wyjazdo.pl.

**Changed:** failures are logged with the recipient and subject. Consent
records are written before responding. Emails after registration,
promotion and "resend link" are sent via Next's `after()`, which keeps the
Worker alive until they finish. Every user-supplied value in email HTML is
escaped. Participant emails have reply-to set to the organizer's contact
email when there is one.

**Check:** register with first name `<b>Ala</b>`: the email shows the
brackets as text. Reply to the confirmation email: the reply goes to the
organizer's contact address. In Cloudflare logs, a send to an invalid
address shows "[email] send rejected".

## 10. Cancelling did not stop payments

**Changed:** cancelling a participant expires their open checkouts in
Stripe. The balance button refuses cancelled participants. If a payment
still arrives for a cancelled participant, it is recorded, the participant
stays cancelled, and the organizer gets an email and a "needs attention"
note.

**Check:** register, do not pay, cancel in the dashboard, open the checkout
link: Stripe says it expired.

## 11. Partial refunds marked the whole payment refunded

**Changed:** the refunded amount is stored on the payment. A payment only
becomes "refunded" when fully refunded; a partial refund keeps it paid and
the finance page subtracts the refunded part from revenue and shows it
under refunds. The participant keeps their place after a partial refund.

**Check:** pay a 1000 zł deposit, refund 500 zł in the Stripe dashboard. The
participant still shows deposit paid, the finance page shows 500 zł revenue
and 500 zł refunded. Refund the rest: the participant shows refunded.

## 12. A pending participant had no way back to payment

**Changed:** the trip page shows "Dokończ płatność" while a checkout is
open (it reopens the same checkout) and "Opłać ponownie" after it lapsed
(a new checkout, only if there is still room; otherwise a message says
there are no places). The double-submit protection sends people to this
page, so they can continue.

**Check:** register, close Stripe, submit the same form again within a
minute: you land on the trip page with a "Dokończ płatność" button that
opens the checkout.

## 13. Duplicate balance rows

**Changed:** an expired or failed balance row is reused instead of adding
a new one, a guarded insert prevents two rows on a double click, and all
readers pick the live row.

**Check:** pay the deposit, click "Opłać dopłatę", close Stripe, wait for
the checkout to expire (or expire it in Stripe), click again. The database
still has one balance row for the participant.

## 14. Stripe's 2.00 zł minimum

**Changed:** prices must be 0 (free) or at least 2 zł, deposits at least
2 zł; the editor shows the message. At registration, a deposit or balance
that would fall below 2 zł turns into a full payment; a total below 2 zł is
refused before anything is saved.

**Check:** set a price of 1.50 zł in the editor: it is rejected with a clear
message.

## 15. Webhook processing

**Wrong:** the event was recorded as processed before handling. The old
code did remove the record if the handler threw, so the audit overstates
this: the real gap was a Worker dying mid-handler (no chance to remove the
record), after which Stripe's retry was skipped.

**Changed:** the event is recorded only after it was handled. All handlers
are safe to run twice. `checkout.session.completed` only records a success
when Stripe says it is paid, and the two async events are handled.

BLIK and Przelewy24: according to Stripe's documentation, Przelewy24 gives
immediate notification, and BLIK is confirmed in the bank app within about
60 seconds before Checkout completes. Neither is a delayed-notification
method in Checkout, so `checkout.session.completed` arrives already paid.
The async handling is there in case that changes.

**Check:** in the Stripe dashboard, resend a `checkout.session.completed`
event for a paid registration: nothing changes and no second email is sent.

## 16. Smaller fixes

- /my-trips email lookup is case-insensitive; emails are stored lower case
  (existing rows are converted by the migration).
- Registration and magic-link requests are rate limited (5 per minute per
  IP; magic links also 5 per minute per address). The limiter is in memory
  per Worker instance, so it is basic protection only.
- "Połącz Stripe" clicked twice creates one Express account (Stripe
  idempotency key, and the account id is only stored if none is set).
- The thanks page only shows a status for a participant of that event.
- Lint error on the landing page fixed.

**Check:** sign in to /my-trips with your email in capital letters: your
trips show. Double-click "Połącz Stripe" on a fresh organizer: the Stripe
dashboard has one new connected account.

## Left open

- Removing a person from a registration that has not paid yet does not
  change an already open checkout; it is charged at the old amount. The
  balance later is correct (it uses what was actually paid).
- Events created before attendee types existed (no attendee rows) still
  use the current event price for the balance.
- The rate limiter is per Worker instance, not global.

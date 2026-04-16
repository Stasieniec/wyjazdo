# Participant Management Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give organizers action buttons to cancel any participant, promote from waitlist, and resend payment links — all from the participant table in the dashboard.

**Architecture:** Four server actions in the existing `actions.ts` file, backed by small DB query additions. The `ParticipantsTable` component gains contextual action buttons per row based on derived status. Two new email templates follow the existing inline-HTML pattern. No new files — all changes are additions to existing modules.

**Tech Stack:** Next.js (server actions), Drizzle ORM (SQLite), Stripe Checkout Sessions, Resend (email)

**Spec:** `docs/superpowers/specs/2026-04-16-participant-management-actions-design.md`

---

### Task 1: Widen `cancelParticipant` DB query to accept any non-cancelled status

**Files:**
- Modify: `src/lib/db/queries/participants.ts:30-41`

Currently `cancelParticipant` only cancels participants with `lifecycleStatus = "active"`. We need it to also cancel `waitlisted` participants.

- [ ] **Step 1: Update `cancelParticipant` to remove the active-only guard**

In `src/lib/db/queries/participants.ts`, replace the existing `cancelParticipant` function:

```typescript
export async function cancelParticipant(participantId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.participants)
    .set({ lifecycleStatus: "cancelled", updatedAt: Date.now() })
    .where(
      and(
        eq(schema.participants.id, participantId),
        eq(schema.participants.lifecycleStatus, "active"),
      ),
    );
}
```

Replace with:

```typescript
export async function cancelParticipant(participantId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.participants)
    .set({ lifecycleStatus: "cancelled", updatedAt: Date.now() })
    .where(eq(schema.participants.id, participantId));
}
```

- [ ] **Step 2: Add `activateWaitlistedParticipant` query**

In the same file, add this new function after `cancelParticipant`:

```typescript
export async function activateWaitlistedParticipant(participantId: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(schema.participants)
    .set({ lifecycleStatus: "active", updatedAt: Date.now() })
    .where(
      and(
        eq(schema.participants.id, participantId),
        eq(schema.participants.lifecycleStatus, "waitlisted"),
      ),
    )
    .returning({ id: schema.participants.id });
  return updated.length > 0;
}
```

- [ ] **Step 3: Add `resetPaymentToPending` query to payments**

In `src/lib/db/queries/payments.ts`, add this function (needed by the resend action in Task 3):

```typescript
export async function resetPaymentToPending(paymentId: string, expiresAt: number): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "pending", expiresAt, updatedAt: Date.now() })
    .where(eq(schema.payments.id, paymentId));
}
```

- [ ] **Step 4: Verify the app builds**

Run: `npm run build` (or the project's build command)
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/queries/participants.ts src/lib/db/queries/payments.ts
git commit -m "feat(db): widen cancelParticipant, add activateWaitlistedParticipant and resetPaymentToPending"
```

---

### Task 2: Add email templates for waitlist promotion and resend payment link

**Files:**
- Modify: `src/lib/email/templates.ts`
- Modify: `src/lib/email/send.ts`

- [ ] **Step 1: Add waitlist promotion email template**

In `src/lib/email/templates.ts`, add these functions at the end of the file (before the closing, after `paymentConfirmedHtml`):

```typescript
// ─── Waitlist Promoted ─────────────────────────────────────────────────────

export function waitlistPromotedSubject(eventTitle: string): string {
  return `Zwolniło się miejsce — ${eventTitle}`;
}

export function waitlistPromotedHtml(params: {
  participantName: string;
  eventTitle: string;
  paymentUrl: string;
  expiryDate: string;
  eventDate: string;
  eventLocation: string | null;
  organizerName: string;
}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Zwolniło się miejsce!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Cześć ${params.participantName}, mamy dobrą wiadomość — zwolniło się miejsce
      na <strong>${params.eventTitle}</strong>. Aby potwierdzić udział, opłać rezerwację
      klikając poniższy przycisk.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Wydarzenie</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">${params.eventTitle}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Termin</p>
        <p style="margin:0 0 12px;font-size:15px;color:#111827;">${params.eventDate}</p>
        ${params.eventLocation ? `
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Miejsce</p>
        <p style="margin:0;font-size:15px;color:#111827;">${params.eventLocation}</p>
        ` : ""}
      </td></tr>
    </table>
    ${button(params.paymentUrl, "Opłać i potwierdź udział")}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      Link ważny do: <strong>${params.expiryDate}</strong>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      Organizator: ${params.organizerName}
    </p>
  `);
}
```

- [ ] **Step 2: Add resend payment link email template**

In the same file, add right after the waitlist promoted template:

```typescript
// ─── Resend Payment Link ───────────────────────────────────────────────────

export function resendPaymentLinkSubject(eventTitle: string): string {
  return `Nowy link do płatności — ${eventTitle}`;
}

export function resendPaymentLinkHtml(params: {
  participantName: string;
  eventTitle: string;
  paymentUrl: string;
  organizerName: string;
}): string {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Nowy link do płatności</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Cześć ${params.participantName}, wygenerowaliśmy nowy link do płatności
      za <strong>${params.eventTitle}</strong>. Kliknij poniższy przycisk, aby dokończyć płatność.
    </p>
    ${button(params.paymentUrl, "Opłać teraz")}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      Link wygaśnie za 30 minut.
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      Organizator: ${params.organizerName}
    </p>
  `);
}
```

- [ ] **Step 3: Add send functions in `send.ts`**

In `src/lib/email/send.ts`, add the two new imports at the top (to the existing import block from `./templates`):

Add `waitlistPromotedSubject`, `waitlistPromotedHtml`, `resendPaymentLinkSubject`, `resendPaymentLinkHtml` to the import list.

Then add these two public functions at the end of the file:

```typescript
export async function sendWaitlistPromoted(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  paymentUrl: string;
  expiryDate: string;
  eventDate: string;
  eventLocation: string | null;
  organizerName: string;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: waitlistPromotedSubject(params.eventTitle),
    html: waitlistPromotedHtml(params),
  });
}

export async function sendResendPaymentLink(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  paymentUrl: string;
  organizerName: string;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: resendPaymentLinkSubject(params.eventTitle),
    html: resendPaymentLinkHtml(params),
  });
}
```

- [ ] **Step 4: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates.ts src/lib/email/send.ts
git commit -m "feat(email): add waitlist promotion and resend payment link templates"
```

---

### Task 3: Add `promoteFromWaitlistAction` and `resendPaymentLinkAction` server actions

**Files:**
- Modify: `src/app/dashboard/events/[id]/actions.ts`

This is the heaviest task. Both actions follow the existing auth pattern and create Stripe Checkout Sessions.

- [ ] **Step 1: Add new imports**

In `src/app/dashboard/events/[id]/actions.ts`, update the imports. Add to the existing import from `@/lib/db/queries/participants`:

```typescript
import { getParticipantById, cancelParticipant, activateWaitlistedParticipant } from "@/lib/db/queries/participants";
```

Add new imports:

```typescript
import { getPaymentById, setBalanceDueAtForPayment, insertPayment, setPaymentStripeSession, listPaymentsForParticipant, resetPaymentToPending } from "@/lib/db/queries/payments";
import { countTakenSpots } from "@/lib/capacity";
import { getStripe } from "@/lib/stripe";
import { newId } from "@/lib/ids";
import { sendWaitlistPromoted, sendResendPaymentLink } from "@/lib/email/send";
import { publicEventUrl } from "@/lib/urls";
```

Note: `getPaymentById` and `setBalanceDueAtForPayment` are already imported — just add the new ones to the existing import statement. Also remove `setPaymentStripeSession` if it's not already imported (it's not in the current file — it's only in process-registration).

- [ ] **Step 2: Rename `cancelAndFreeSpotAction` to `cancelParticipantAction`**

In the same file, rename the function:

```typescript
export async function cancelParticipantAction(form: FormData): Promise<void> {
```

The body stays the same — it already calls `cancelParticipant(participantId)` which now handles both active and waitlisted.

- [ ] **Step 3: Add `promoteFromWaitlistAction`**

Add this function to the actions file:

```typescript
export async function promoteFromWaitlistAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");
  if (!organizer.stripeAccountId) throw new Error("stripe not connected");

  const participantId = String(form.get("participantId") ?? "");
  const expiresAtStr = String(form.get("expiresAt") ?? "");
  if (!participantId || !expiresAtStr) throw new Error("missing fields");

  const expiresAtMs = new Date(expiresAtStr).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error("invalid expiry date");
  }

  const participant = await getParticipantById(participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");
  if (participant.lifecycleStatus !== "waitlisted") throw new Error("not waitlisted");

  // Capacity check
  const taken = await countTakenSpots(event.id, Date.now());
  if (taken >= event.capacity) throw new Error("no capacity");

  const activated = await activateWaitlistedParticipant(participantId);
  if (!activated) throw new Error("activation failed");

  // Create payment
  const now = Date.now();
  const depositMode =
    event.depositCents != null &&
    event.depositCents > 0 &&
    event.depositCents < event.priceCents;
  const paymentId = newId();
  const paymentKind: "deposit" | "full" = depositMode ? "deposit" : "full";
  const paymentAmount = depositMode ? event.depositCents! : event.priceCents;

  await insertPayment({
    id: paymentId,
    participantId,
    kind: paymentKind,
    amountCents: paymentAmount,
    currency: "PLN",
    status: "pending",
    dueAt: null,
    stripeSessionId: null,
    stripePaymentIntentId: null,
    stripeApplicationFee: null,
    lastReminderAt: null,
    paidAt: null,
    expiresAt: expiresAtMs,
    createdAt: now,
    updatedAt: now,
  });

  const stripe = getStripe();
  const eventUrl = publicEventUrl(organizer.subdomain, event.slug);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: participant.email,
      line_items: [
        {
          price_data: {
            currency: "pln",
            unit_amount: paymentAmount,
            product_data: {
              name: depositMode ? `Zaliczka — ${event.title}` : event.title,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { payment_id: paymentId, participant_id: participantId },
      payment_intent_data: {
        application_fee_amount: 0,
        metadata: { payment_id: paymentId, participant_id: participantId },
      },
      success_url: `${eventUrl}/thanks?pid=${participantId}`,
      cancel_url: eventUrl,
      expires_at: Math.floor(expiresAtMs / 1000),
    },
    { stripeAccount: organizer.stripeAccountId },
  );

  await setPaymentStripeSession(paymentId, session.id);

  // Send email (fire-and-forget)
  const eventDate = new Date(event.startsAt).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const expiryDate = new Date(expiresAtMs).toLocaleString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  sendWaitlistPromoted({
    to: participant.email,
    participantName: participant.firstName,
    eventTitle: event.title,
    paymentUrl: session.url!,
    expiryDate,
    eventDate,
    eventLocation: event.location,
    organizerName: organizer.displayName,
  }).catch(() => {});

  revalidatePath(`/dashboard/events/${event.id}`);
}
```

- [ ] **Step 4: Add `resendPaymentLinkAction`**

Add this function to the actions file:

```typescript
const PENDING_TTL_MS = 30 * 60 * 1000;

export async function resendPaymentLinkAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");
  if (!organizer.stripeAccountId) throw new Error("stripe not connected");

  const participantId = String(form.get("participantId") ?? "");
  if (!participantId) throw new Error("missing participantId");

  const participant = await getParticipantById(participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");

  const payments = await listPaymentsForParticipant(participantId);
  // Find the payment that needs a fresh session: pending or expired, not succeeded
  const target = payments.find(
    (p) => (p.status === "pending" || p.status === "expired") && p.kind !== "balance",
  ) ?? payments.find(
    (p) => (p.status === "pending" || p.status === "expired"),
  );

  if (!target) throw new Error("no payment to resend");

  const now = Date.now();
  const expiresAt = now + PENDING_TTL_MS;

  // Reset expired payment back to pending
  if (target.status === "expired") {
    await resetPaymentToPending(target.id, expiresAt);
  }

  const stripe = getStripe();
  const eventUrl = publicEventUrl(organizer.subdomain, event.slug);
  const depositMode = target.kind === "deposit";

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: participant.email,
      line_items: [
        {
          price_data: {
            currency: "pln",
            unit_amount: target.amountCents,
            product_data: {
              name: depositMode ? `Zaliczka — ${event.title}` : event.title,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { payment_id: target.id, participant_id: participantId },
      payment_intent_data: {
        application_fee_amount: 0,
        metadata: { payment_id: target.id, participant_id: participantId },
      },
      success_url: `${eventUrl}/thanks?pid=${participantId}`,
      cancel_url: eventUrl,
      expires_at: Math.floor(expiresAt / 1000),
    },
    { stripeAccount: organizer.stripeAccountId },
  );

  await setPaymentStripeSession(target.id, session.id);

  // Send email (fire-and-forget)
  sendResendPaymentLink({
    to: participant.email,
    participantName: participant.firstName,
    eventTitle: event.title,
    paymentUrl: session.url!,
    organizerName: organizer.displayName,
  }).catch(() => {});

  revalidatePath(`/dashboard/events/${event.id}`);
}
```

- [ ] **Step 5: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. The new actions aren't wired to UI yet, but they should compile without errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/events/[id]/actions.ts
git commit -m "feat(actions): add promoteFromWaitlist, resendPaymentLink, widen cancel to all statuses"
```

---

### Task 4: Update `ParticipantsTable` with contextual action buttons

**Files:**
- Modify: `src/components/dashboard/ParticipantsTable.tsx`

This task rewires the action buttons so each participant row shows the appropriate actions based on their derived status and lifecycle status.

- [ ] **Step 1: Update imports**

In `src/components/dashboard/ParticipantsTable.tsx`, replace the action import:

```typescript
import { extendBalanceDeadlineAction, cancelAndFreeSpotAction } from "@/app/dashboard/events/[id]/actions";
```

with:

```typescript
import {
  extendBalanceDeadlineAction,
  cancelParticipantAction,
  promoteFromWaitlistAction,
  resendPaymentLinkAction,
} from "@/app/dashboard/events/[id]/actions";
```

- [ ] **Step 2: Replace the action buttons section in the row render**

Replace the entire actions `<td>` content (the `<div className="flex flex-col gap-2">` block inside the actions cell). The old code shows cancel and extend only for `ds === "overdue"`. The new code shows contextual actions for all statuses.

Replace the block starting with `<td className="py-2 pr-4">` (the last `<td>` in the row, containing the actions `<div>`) — everything from `<td className="py-2 pr-4">` through its closing `</td>` in the actions column — with:

```tsx
<td className="py-2 pr-4">
  <div className="flex flex-col gap-2">
    {participantConsents.length > 0 && (
      <button
        type="button"
        onClick={() => setExpandedConsents((prev) => {
          const next = new Set(prev);
          if (next.has(p.id)) next.delete(p.id);
          else next.add(p.id);
          return next;
        })}
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
      >
        Zgody ({participantConsents.length})
      </button>
    )}

    {/* Cancel — any non-terminal status */}
    {ds !== "cancelled" && ds !== "refunded" && (
      <form
        action={cancelParticipantAction}
        onSubmit={(e) => {
          const hasPaid = ds === "paid" || ds === "deposit_paid" || ds === "overdue";
          const msg = hasPaid
            ? `Czy na pewno chcesz anulować uczestnika ${p.firstName} ${p.lastName}? Uczestnik dokonał płatności — zwrot środków należy wykonać ręcznie przez panel Stripe.`
            : `Czy na pewno chcesz anulować uczestnika ${p.firstName} ${p.lastName}?`;
          if (!window.confirm(msg)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="participantId" value={p.id} />
        <button
          type="submit"
          className="rounded border border-destructive/40 bg-background px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
        >
          Anuluj
        </button>
      </form>
    )}

    {/* Promote from waitlist */}
    {ds === "waitlisted" && (
      <form action={promoteFromWaitlistAction}>
        <input type="hidden" name="participantId" value={p.id} />
        <div className="flex items-center gap-1">
          <input
            type="datetime-local"
            name="expiresAt"
            required
            className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
          >
            Przenieś z listy
          </button>
        </div>
      </form>
    )}

    {/* Extend balance deadline — overdue with balance payment */}
    {ds === "overdue" && balancePayment && (
      <form action={extendBalanceDeadlineAction} className="flex items-center gap-1">
        <input type="hidden" name="paymentId" value={balancePayment.id} />
        <input
          type="datetime-local"
          name="dueAt"
          required
          className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
        >
          Przedłuż termin
        </button>
      </form>
    )}

    {/* Resend payment link — active lifecycle, no succeeded payments */}
    {p.lifecycleStatus === "active" && !participantPayments.some((pay) => pay.status === "succeeded") && ds !== "cancelled" && (
      <form
        action={resendPaymentLinkAction}
        onSubmit={(e) => {
          if (!window.confirm(`Wyślić ponownie link do płatności dla ${p.firstName} ${p.lastName}?`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="participantId" value={p.id} />
        <button
          type="submit"
          className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
        >
          Wyślij link do płatności
        </button>
      </form>
    )}
  </div>
</td>
```

- [ ] **Step 3: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/ParticipantsTable.tsx
git commit -m "feat(dashboard): contextual participant action buttons based on status"
```

---

### Task 5: Manual smoke test

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (or equivalent)

- [ ] **Step 2: Test cancel on different statuses**

Navigate to the organizer dashboard, find an event with participants. Verify:
- "Anuluj" button appears for `paid`, `deposit_paid`, `overdue`, `pending`, and `waitlisted` participants
- "Anuluj" button does NOT appear for `cancelled` or `refunded` participants
- Clicking "Anuluj" on a paid participant shows the confirmation dialog mentioning Stripe refund
- Clicking "Anuluj" on a waitlisted/pending participant shows the simpler confirmation dialog
- After confirming, the participant status changes to `cancelled`

- [ ] **Step 3: Test waitlist promotion**

Find a waitlisted participant. Verify:
- "Przenieś z listy" form appears with a datetime input
- Submitting with a future date changes the participant from waitlisted to active/pending
- The participant should appear in the main table, not the waitlist section

- [ ] **Step 4: Test resend payment link**

Find a participant with `pending` derived status (or one whose payment expired). Verify:
- "Wyślij link do płatności" button appears
- Clicking shows confirmation dialog
- After confirming, the action completes without errors

- [ ] **Step 5: Test extend deadline (regression)**

Verify the existing "Przedłuż termin" action still works for overdue participants.

- [ ] **Step 6: Final commit if any fixes were needed**

If any fixes were applied during testing:
```bash
git add -A
git commit -m "fix(dashboard): adjustments from manual smoke test"
```

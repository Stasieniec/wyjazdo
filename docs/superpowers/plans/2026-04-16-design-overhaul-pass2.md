# Wyjazdo Design Overhaul Pass 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the design system from Pass 1 to all remaining pages and components — remove hardcoded black buttons, neutral-* colors, and add consistent shadows/radius.

**Architecture:** Pure find-and-replace styling changes. No new files, no data model changes, no new components.

**Tech Stack:** Same as Pass 1 — Next.js App Router, Tailwind CSS 4, existing UI components.

**Spec:** `docs/superpowers/specs/2026-04-16-design-overhaul-pass2-design.md`

---

## File Structure

### Modified files
| File | Change |
|------|--------|
| `src/components/dashboard/TimePickerSelects.tsx` | Replace all neutral-* colors with design system tokens |
| `src/components/dashboard/ParticipantsTable.tsx` | Replace statusColor function with design-system colors |
| `src/app/my-trips/page.tsx` | Replace neutral colors, add Card, fix container, add header |
| `src/app/my-trips/[id]/page.tsx` | Replace black button, neutral colors, add Card |
| `src/app/my-trips/request-link/page.tsx` | Replace black button, fix alerts, fix input styling |
| `src/app/dashboard/onboarding/payouts/page.tsx` | Replace black button, fix heading |
| `src/app/dashboard/onboarding/payouts/return/page.tsx` | Replace black button, fix heading, style link |
| `src/app/sites/[subdomain]/[eventSlug]/page.tsx` | Update rounded-lg to rounded-xl on info cards, add shadows |

---

## Task 1: TimePickerSelects — Replace Neutral Colors

**Files:**
- Modify: `src/components/dashboard/TimePickerSelects.tsx`

- [ ] **Step 1: Replace all neutral color classes**

In `src/components/dashboard/TimePickerSelects.tsx`, make these replacements (use replace_all where the string appears multiple times):

Line 25 — hint label:
```
text-neutral-500 → text-muted-foreground
```

Line 32 — hour select:
```
text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500/25
→
text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25
```

Also on line 32, the bare `border` should become `border border-border`.

Line 53 — colon separator:
```
text-neutral-400 → text-muted-foreground
```

Line 57 — minute hint:
```
text-neutral-500 → text-muted-foreground
```

Line 65 — minute select:
```
text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500/25 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400
→
text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground
```

Also on line 65, `border` → `border border-border`.

Line 94 — SelectChevron:
```
text-neutral-500 → text-muted-foreground
```

- [ ] **Step 2: Verify no neutral-* classes remain**

Run: `grep -n "neutral" src/components/dashboard/TimePickerSelects.tsx`
Expected: No results.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/TimePickerSelects.tsx
git commit -m "style: replace hardcoded neutral colors in TimePickerSelects"
```

---

## Task 2: ParticipantsTable — Status Badge Colors

**Files:**
- Modify: `src/components/dashboard/ParticipantsTable.tsx`

- [ ] **Step 1: Replace the statusColor function**

In `src/components/dashboard/ParticipantsTable.tsx`, replace the entire `statusColor` function (lines 158-167) from:

```tsx
function statusColor(status: DerivedStatus): string {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "deposit_paid": return "bg-emerald-100 text-emerald-700";
    case "overdue": return "bg-orange-100 text-orange-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "waitlisted": return "bg-blue-100 text-blue-800";
    case "cancelled": return "bg-neutral-100 text-neutral-600";
    case "refunded": return "bg-purple-100 text-purple-800";
    default: return "bg-neutral-100 text-neutral-600";
  }
}
```

to:

```tsx
function statusColor(status: DerivedStatus): string {
  switch (status) {
    case "paid": return "bg-success/10 text-success";
    case "deposit_paid": return "bg-success/10 text-success";
    case "overdue": return "bg-amber-50 text-amber-700";
    case "pending": return "bg-amber-50 text-amber-700";
    case "waitlisted": return "bg-primary/10 text-primary";
    case "cancelled": return "bg-muted text-muted-foreground";
    case "refunded": return "bg-destructive/10 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}
```

- [ ] **Step 2: Verify no neutral-* classes remain in the file**

Run: `grep -n "neutral" src/components/dashboard/ParticipantsTable.tsx`
Expected: No results.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/ParticipantsTable.tsx
git commit -m "style: align ParticipantsTable status badges with design system"
```

---

## Task 3: My-Trips List Page

**Files:**
- Modify: `src/app/my-trips/page.tsx`

- [ ] **Step 1: Add Card import and rewrite the page styling**

Replace the entire content of `src/app/my-trips/page.tsx` with:

```tsx
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listTripSummariesByEmail } from "@/lib/db/queries/participants";
import { listPaymentsForParticipants } from "@/lib/db/queries/payments";
import {
  verifyMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";
import { derivedStatus, type PaymentLike } from "@/lib/participant-status";
import { Card } from "@/components/ui";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";

const STATUS_LABELS: Record<string, string> = {
  paid: "Opłacony",
  deposit_paid: "Zaliczka opłacona",
  pending: "Oczekuje na płatność",
  overdue: "Zaległa płatność",
  waitlisted: "Lista rezerwowa",
  cancelled: "Anulowany",
  refunded: "Zwrócony",
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-success/10 text-success",
  deposit_paid: "bg-success/10 text-success",
  pending: "bg-amber-50 text-amber-700",
  overdue: "bg-amber-50 text-amber-700",
  waitlisted: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

export default async function MyTripsIndex() {
  const secret = getParticipantAuthSecret();
  const now = Date.now();
  const c = (await cookies()).get("wyjazdo_participant_email")?.value;
  if (!c) redirect("/my-trips/request-link");
  const session = await verifyMagicLinkCookie(c, secret, now);
  if (!session) redirect("/my-trips/request-link?invalid=1");

  const trips = await listTripSummariesByEmail(session.email);
  const allPayments = await listPaymentsForParticipants(trips.map((t) => t.participantId));
  const byPid = new Map<string, PaymentLike[]>();
  for (const p of allPayments) {
    const list = byPid.get(p.participantId) ?? [];
    list.push({
      kind: p.kind as PaymentLike["kind"],
      status: p.status as PaymentLike["status"],
      dueAt: p.dueAt,
    });
    byPid.set(p.participantId, list);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-primary">
            <WyjazdoMark className="h-7 w-7 shrink-0" />
            wyjazdo
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-bold sm:text-2xl">Twoje wyjazdy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Zalogowano jako {session.email}</p>
        {trips.length === 0 && (
          <Card className="mt-6 text-center" padding="lg">
            <p className="text-sm text-muted-foreground">Nie masz jeszcze żadnych rejestracji.</p>
          </Card>
        )}
        <ul className="mt-6 space-y-3">
          {trips.map((t) => {
            const status = derivedStatus(
              { lifecycleStatus: t.lifecycleStatus },
              byPid.get(t.participantId) ?? [],
              now,
            );
            return (
              <li key={t.participantId}>
                <Card padding="sm" className="transition-all duration-150 hover:shadow-md">
                  <Link href={`/my-trips/${t.participantId}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-foreground">{t.eventTitle}</h2>
                        <p className="text-sm text-muted-foreground">{t.organizerName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {new Date(t.eventStartsAt).toLocaleDateString("pl-PL", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                          {t.eventLocation ? ` · ${t.eventLocation}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[status] ?? status}
                      </span>
                    </div>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/my-trips/page.tsx
git commit -m "style: redesign my-trips list with Card, status badges, header"
```

---

## Task 4: My-Trips Detail Page

**Files:**
- Modify: `src/app/my-trips/[id]/page.tsx`

- [ ] **Step 1: Restyle the trip detail page**

Replace the entire content of `src/app/my-trips/[id]/page.tsx` with:

```tsx
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTripView } from "@/lib/db/queries/trip-view";
import {
  verifyParticipantToken,
  verifyMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";
import { derivedStatus } from "@/lib/participant-status";
import { payBalanceAction } from "./actions";
import { formatPlnFromCents } from "@/lib/format-currency";
import { Card } from "@/components/ui";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";

const STATUS_LABELS: Record<string, string> = {
  paid: "Opłacony",
  deposit_paid: "Zaliczka opłacona",
  pending: "Oczekuje na płatność",
  overdue: "Zaległa płatność",
  waitlisted: "Lista rezerwowa",
  cancelled: "Anulowany",
  refunded: "Zwrócony",
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-success/10 text-success",
  deposit_paid: "bg-success/10 text-success",
  pending: "bg-amber-50 text-amber-700",
  overdue: "bg-amber-50 text-amber-700",
  waitlisted: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  const secret = getParticipantAuthSecret();
  const now = Date.now();

  const trip = await getTripView(id);
  if (!trip) notFound();

  const tokenOk = t ? await verifyParticipantToken(t, id, secret) : false;

  let cookieOk = false;
  if (!tokenOk) {
    const c = (await cookies()).get("wyjazdo_participant_email")?.value;
    if (c) {
      const session = await verifyMagicLinkCookie(c, secret, now);
      if (session && session.email.toLowerCase() === trip.participant.email.toLowerCase()) {
        cookieOk = true;
      }
    }
  }
  if (!tokenOk && !cookieOk) notFound();

  const status = derivedStatus(
    { lifecycleStatus: trip.participant.lifecycleStatus },
    trip.payments.map((p) => ({ kind: p.kind, status: p.status, dueAt: p.dueAt })),
    now,
  );

  const deposit = trip.payments.find((p) => p.kind === "deposit");
  const balance = trip.payments.find((p) => p.kind === "balance");
  const full = trip.payments.find((p) => p.kind === "full");
  const balanceDue = balance?.dueAt ?? trip.event.balanceDueAt ?? null;

  const showPayBalance = status === "deposit_paid" || status === "overdue";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-primary">
            <WyjazdoMark className="h-7 w-7 shrink-0" />
            wyjazdo
          </Link>
          <Link href="/my-trips" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            ← Twoje wyjazdy
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold sm:text-2xl">{trip.event.title}</h1>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">{trip.organizer.displayName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(trip.event.startsAt).toLocaleString("pl-PL")}
            {trip.event.location ? ` · ${trip.event.location}` : ""}
          </p>
        </div>

        <Card padding="md">
          <h2 className="font-semibold text-foreground">Płatność</h2>
          <div className="mt-3 space-y-2 text-sm">
            {full && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{full.status === "succeeded" ? "Opłacone" : "Oczekuje"}</span>
                <span className="font-medium">{formatPlnFromCents(full.amountCents)}</span>
              </div>
            )}
            {deposit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zaliczka {deposit.status === "succeeded" ? "(opłacona)" : "(oczekuje)"}</span>
                <span className="font-medium">{formatPlnFromCents(deposit.amountCents)}</span>
              </div>
            )}
            {balance && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dopłata {balance.status === "succeeded" ? "(opłacona)" : "(oczekuje)"}</span>
                <span className="font-medium">{formatPlnFromCents(balance.amountCents)}</span>
              </div>
            )}
            {balanceDue && (
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Termin dopłaty</span>
                <span className="font-medium">{new Date(balanceDue).toLocaleDateString("pl-PL")}</span>
              </div>
            )}
          </div>

          {showPayBalance && (
            <form action={payBalanceAction} className="mt-4 pt-4 border-t border-border">
              <input type="hidden" name="participantId" value={trip.participant.id} />
              <input type="hidden" name="token" value={t ?? ""} />
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
              >
                Opłać dopłatę
              </button>
            </form>
          )}
        </Card>

        {trip.organizer.contactEmail && (
          <p className="text-sm text-muted-foreground">
            Pytanie?{" "}
            <a className="text-primary underline underline-offset-2 hover:text-primary/80" href={`mailto:${trip.organizer.contactEmail}`}>
              Skontaktuj się z organizatorem
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/my-trips/[id]/page.tsx
git commit -m "style: redesign my-trips detail with Card, status badge, coral CTA"
```

---

## Task 5: My-Trips Request Link Page

**Files:**
- Modify: `src/app/my-trips/request-link/page.tsx`

- [ ] **Step 1: Restyle the request link page**

Replace the entire content of `src/app/my-trips/request-link/page.tsx` with:

```tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  signMagicLinkOneTime,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";
import { sendMagicLinkEmail } from "@/lib/email/send";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";

function origin() {
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  return `${proto}//${host}`;
}

export default async function RequestLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; invalid?: string }>;
}) {
  const sp = await searchParams;

  async function submit(form: FormData) {
    "use server";
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!email) redirect("/my-trips/request-link");
    const secret = getParticipantAuthSecret();
    const now = Date.now();
    const token = await signMagicLinkOneTime(email, now, secret);
    const link = `${origin()}/my-trips/signin?token=${encodeURIComponent(token)}`;
    await sendMagicLinkEmail({ to: email, link });
    redirect("/my-trips/request-link?sent=1");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-primary">
            <WyjazdoMark className="h-7 w-7 shrink-0" />
            wyjazdo
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 space-y-4">
        <h1 className="text-xl font-bold sm:text-2xl">Twoje wyjazdy</h1>
        {sp.invalid && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Link wygasł lub jest nieprawidłowy. Poproś o nowy poniżej.
          </div>
        )}
        {sp.sent ? (
          <div className="rounded-xl border border-success/40 bg-success/5 p-4 text-sm text-success">
            Wysłaliśmy link logowania. Sprawdź skrzynkę.
          </div>
        ) : (
          <form action={submit} className="space-y-3">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email, z którym się rejestrowałeś/aś
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="twoj@email.pl"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
            >
              Wyślij link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/my-trips/request-link/page.tsx
git commit -m "style: redesign request-link page with design system alerts and coral CTA"
```

---

## Task 6: Onboarding Payouts Pages

**Files:**
- Modify: `src/app/dashboard/onboarding/payouts/page.tsx`
- Modify: `src/app/dashboard/onboarding/payouts/return/page.tsx`

- [ ] **Step 1: Update payouts page**

In `src/app/dashboard/onboarding/payouts/page.tsx`, make these edits:

Change the h1 from:
```tsx
<h1 className="text-2xl font-semibold">Skonfiguruj wypłaty</h1>
```
to:
```tsx
<h1 className="text-xl font-bold sm:text-2xl">Skonfiguruj wypłaty</h1>
```

Change the paragraph from:
```tsx
<p>
```
to:
```tsx
<p className="text-muted-foreground">
```

Change the button from:
```tsx
className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-neutral-800"
```
to:
```tsx
className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
```

- [ ] **Step 2: Update return page**

In `src/app/dashboard/onboarding/payouts/return/page.tsx`, make these edits:

Change the h1 from:
```tsx
<h1 className="text-2xl font-semibold">Jeszcze chwila</h1>
```
to:
```tsx
<h1 className="text-xl font-bold sm:text-2xl">Jeszcze chwila</h1>
```

Change the paragraph from:
```tsx
<p>Stripe potrzebuje dodatkowych informacji, aby aktywować wypłaty.</p>
```
to:
```tsx
<p className="text-muted-foreground">Stripe potrzebuje dodatkowych informacji, aby aktywować wypłaty.</p>
```

Change the button from:
```tsx
className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-neutral-800"
```
to:
```tsx
className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
```

Change the back link from:
```tsx
<p><Link href="/dashboard" className="underline">Wróć do panelu</Link></p>
```
to:
```tsx
<p><Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground">Wróć do panelu</Link></p>
```

- [ ] **Step 3: Verify no TypeScript errors and no remaining bg-black classes**

Run: `grep -rn "bg-black\|bg-neutral\|text-neutral" src/app/dashboard/onboarding/ --include="*.tsx"`
Expected: No results.

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/onboarding/payouts/page.tsx src/app/dashboard/onboarding/payouts/return/page.tsx
git commit -m "style: replace black buttons with coral accent in onboarding payouts"
```

---

## Task 7: Public Event Page Polish

**Files:**
- Modify: `src/app/sites/[subdomain]/[eventSlug]/page.tsx`

- [ ] **Step 1: Update info card radius and add shadows**

In `src/app/sites/[subdomain]/[eventSlug]/page.tsx`, find all instances of `rounded-lg` that appear on info card containers (look for patterns like `rounded-lg border` or `rounded-lg bg-muted`) and replace with `rounded-xl`. Also add `shadow-sm` to card-like containers that don't already have it.

Specifically, search for patterns like:
- `rounded-lg border border-border bg-muted` → `rounded-xl border border-border bg-muted shadow-sm`
- `rounded-lg border bg-muted/40` → `rounded-xl border bg-muted/40 shadow-sm`

Do NOT change `rounded-lg` on small elements like buttons or inputs — only on card-like containers.

- [ ] **Step 2: Commit**

```bash
git add src/app/sites/[subdomain]/[eventSlug]/page.tsx
git commit -m "style: update public event page radius and shadows"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Grep for any remaining hardcoded colors across the codebase**

Run: `grep -rn "bg-black\|bg-neutral\|text-neutral" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".superpowers"`

Expected: No results (or only in files that are out of scope, like third-party integrations).

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 3: Commit specs and plans**

```bash
git add docs/superpowers/
git commit -m "docs: add pass 2 design spec and implementation plan"
```

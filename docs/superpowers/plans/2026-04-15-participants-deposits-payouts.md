# Participants, Deposits, and Payouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the three-topic design from `docs/superpowers/specs/2026-04-15-participants-deposits-payouts-design.md` — participant magic-link experience, two-phase deposit/balance payments, and Stripe Connect Express payouts.

**Architecture:** A new `payments` table becomes the source of truth for money movement; `participants.status` shrinks to lifecycle states only (`active | waitlisted | cancelled`) with payment-related states derived. Checkout Sessions are created on connected Stripe accounts using direct charges. Participants never create accounts — HMAC-signed tokens in transactional emails and an email-scoped magic-link cookie grant access to `/my-trips`.

**Tech Stack:** Next.js 16 (App Router) on Cloudflare Workers via `@opennextjs/cloudflare`, D1 (SQLite), Drizzle ORM, Clerk (organizer auth only), Stripe (Checkout + Connect Express), Resend (email), Vitest.

**Reference patterns:**
- Stripe client factory at [src/lib/stripe.ts](src/lib/stripe.ts)
- Existing webhook handler at [src/lib/webhook-handler.ts](src/lib/webhook-handler.ts) (pure orchestrator with deps)
- Existing registration flow at [src/lib/register/process-registration.ts](src/lib/register/process-registration.ts)
- Migrations directory [src/lib/db/migrations/](src/lib/db/migrations/)
- Queries split by table in [src/lib/db/queries/](src/lib/db/queries/)

**Important environment caveats:**
- D1 is SQLite. Writes are not multi-statement-transactional across HTTP boundaries; Drizzle's `db.transaction()` works for batch but not across round trips.
- Workers require `stripe.webhooks.constructEventAsync` (the sync version uses Node crypto — it won't work).
- `nodejs_compat` is enabled but still prefer web-crypto-safe patterns (e.g., `crypto.subtle`) in shared code.
- The existing AGENTS.md says Next.js has breaking changes from training-data defaults; read `node_modules/next/dist/docs/` for Server Actions and middleware when in doubt.

---

## Phase A — Schema and payment primitives (atomic refactor)

This phase lands one migration that adds the `payments` table, adds Connect columns to `organizers`, adds deposit columns to `events`, renames `participants.status` to `lifecycle_status` with a reduced value set, and drops the obsolete participant payment columns. The existing single-payment flow is rewired to use `payments` — no functional change visible to users yet.

### Task A1: Write the Drizzle migration for the schema refactor

**Files:**
- Create: `src/lib/db/migrations/0001_payments_connect.sql`

- [ ] **Step 1: Write the migration**

Create `src/lib/db/migrations/0001_payments_connect.sql`:

```sql
-- 0001_payments_connect.sql
-- Adds: payments table, Connect columns on organizers, deposit columns on events.
-- Changes: participants.status -> lifecycle_status; drops participants payment cols.

CREATE TABLE `payments` (
  `id` text PRIMARY KEY NOT NULL,
  `participant_id` text NOT NULL,
  `kind` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `currency` text DEFAULT 'PLN' NOT NULL,
  `status` text NOT NULL,
  `due_at` integer,
  `stripe_session_id` text,
  `stripe_payment_intent_id` text,
  `stripe_application_fee` integer,
  `last_reminder_at` integer,
  `paid_at` integer,
  `expires_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_participant_idx` ON `payments` (`participant_id`);--> statement-breakpoint
CREATE INDEX `payments_stripe_session_idx` ON `payments` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `payments_status_due_idx` ON `payments` (`status`,`due_at`);--> statement-breakpoint

ALTER TABLE `organizers` ADD COLUMN `stripe_account_id` text;--> statement-breakpoint
ALTER TABLE `organizers` ADD COLUMN `stripe_onboarding_complete` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organizers` ADD COLUMN `stripe_payouts_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organizers` ADD COLUMN `stripe_account_synced_at` integer;--> statement-breakpoint

ALTER TABLE `events` ADD COLUMN `deposit_cents` integer;--> statement-breakpoint
ALTER TABLE `events` ADD COLUMN `balance_due_at` integer;--> statement-breakpoint

ALTER TABLE `participants` RENAME COLUMN `status` TO `lifecycle_status`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `expires_at`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `stripe_session_id`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `stripe_payment_intent_id`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `amount_paid_cents`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `paid_at`;--> statement-breakpoint
DROP INDEX IF EXISTS `participants_event_status_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `participants_stripe_session_idx`;--> statement-breakpoint
CREATE INDEX `participants_event_lifecycle_idx` ON `participants` (`event_id`,`lifecycle_status`);--> statement-breakpoint

-- Any existing rows in dev: collapse to the new value set.
UPDATE `participants` SET `lifecycle_status` = 'active' WHERE `lifecycle_status` IN ('pending','paid','refunded');--> statement-breakpoint
UPDATE `participants` SET `lifecycle_status` = 'cancelled' WHERE `lifecycle_status` NOT IN ('active','waitlisted','cancelled');
```

- [ ] **Step 2: Update the drizzle journal**

Inspect `src/lib/db/migrations/meta/_journal.json` and add a new entry for `0001_payments_connect`. Follow the format of the existing `0000_init` entry (incremented `idx`, matching `version`, unix-ms `when`, same `tag`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/migrations/0001_payments_connect.sql src/lib/db/migrations/meta/_journal.json
git commit -m "db: migration for payments table + Connect + deposit columns"
```

### Task A2: Update Drizzle schema to match the migration

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Rewrite schema.ts**

Replace the entire file contents with:

```ts
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const organizers = sqliteTable("organizers", {
  id: text("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  subdomain: text("subdomain").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  brandColor: text("brand_color"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  socialLinks: text("social_links"),
  stripeAccountId: text("stripe_account_id"),
  stripeOnboardingComplete: integer("stripe_onboarding_complete").notNull().default(0),
  stripePayoutsEnabled: integer("stripe_payouts_enabled").notNull().default(0),
  stripeAccountSyncedAt: integer("stripe_account_synced_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    organizerId: text("organizer_id").notNull().references(() => organizers.id),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("PLN"),
    capacity: integer("capacity").notNull(),
    coverUrl: text("cover_url"),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    customQuestions: text("custom_questions"),
    depositCents: integer("deposit_cents"),
    balanceDueAt: integer("balance_due_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    organizerIdx: index("events_organizer_idx").on(t.organizerId),
    organizerSlugUniq: uniqueIndex("events_organizer_slug_uniq").on(t.organizerId, t.slug),
  }),
);

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    customAnswers: text("custom_answers"),
    lifecycleStatus: text("lifecycle_status", {
      enum: ["active", "waitlisted", "cancelled"],
    }).notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    eventLifecycleIdx: index("participants_event_lifecycle_idx").on(t.eventId, t.lifecycleStatus),
  }),
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id").notNull().references(() => participants.id),
    kind: text("kind", { enum: ["full", "deposit", "balance"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("PLN"),
    status: text("status", {
      enum: ["pending", "succeeded", "expired", "failed", "refunded"],
    }).notNull(),
    dueAt: integer("due_at"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeApplicationFee: integer("stripe_application_fee"),
    lastReminderAt: integer("last_reminder_at"),
    paidAt: integer("paid_at"),
    expiresAt: integer("expires_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    participantIdx: index("payments_participant_idx").on(t.participantId),
    stripeSessionIdx: index("payments_stripe_session_idx").on(t.stripeSessionId),
    statusDueIdx: index("payments_status_due_idx").on(t.status, t.dueAt),
  }),
);

export type Organizer = typeof organizers.$inferSelect;
export type NewOrganizer = typeof organizers.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
```

- [ ] **Step 2: Run type-check to scope the blast radius**

Run: `npx tsc --noEmit`
Expected: many errors pointing at the files that still reference `participants.status`, `participants.stripeSessionId`, etc. This is expected — subsequent tasks fix each.

- [ ] **Step 3: Commit (intentionally not yet green)**

```bash
git add src/lib/db/schema.ts
git commit -m "db: update Drizzle schema for payments refactor (compile breaks follow)"
```

### Task A3: Write the `derivedStatus` pure function with tests

**Files:**
- Create: `src/lib/participant-status.ts`
- Create: `src/lib/participant-status.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/participant-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { derivedStatus, type PaymentLike, type ParticipantLike } from "./participant-status";

const p = (over: Partial<PaymentLike> = {}): PaymentLike => ({
  kind: "full",
  status: "pending",
  dueAt: null,
  ...over,
});

const lc = (status: ParticipantLike["lifecycleStatus"]): ParticipantLike => ({
  lifecycleStatus: status,
});

const NOW = 1_000_000_000_000;

describe("derivedStatus", () => {
  it("returns waitlisted when lifecycle says so", () => {
    expect(derivedStatus(lc("waitlisted"), [], NOW)).toBe("waitlisted");
  });

  it("returns cancelled when lifecycle says so (even with succeeded payments)", () => {
    expect(derivedStatus(lc("cancelled"), [p({ status: "succeeded" })], NOW)).toBe("cancelled");
  });

  it("returns cancelled when active but zero payments", () => {
    expect(derivedStatus(lc("active"), [], NOW)).toBe("cancelled");
  });

  it("returns cancelled when all payments expired or failed", () => {
    expect(derivedStatus(lc("active"), [p({ status: "expired" }), p({ status: "failed" })], NOW)).toBe("cancelled");
  });

  it("returns pending when any payment is pending", () => {
    expect(derivedStatus(lc("active"), [p({ status: "pending" })], NOW)).toBe("pending");
  });

  it("returns paid when a full payment succeeded", () => {
    expect(derivedStatus(lc("active"), [p({ kind: "full", status: "succeeded" })], NOW)).toBe("paid");
  });

  it("returns paid when both deposit and balance succeeded", () => {
    const ps = [p({ kind: "deposit", status: "succeeded" }), p({ kind: "balance", status: "succeeded" })];
    expect(derivedStatus(lc("active"), ps, NOW)).toBe("paid");
  });

  it("returns deposit_paid when only deposit succeeded and no balance row", () => {
    expect(derivedStatus(lc("active"), [p({ kind: "deposit", status: "succeeded" })], NOW)).toBe("deposit_paid");
  });

  it("returns deposit_paid when deposit succeeded and balance is pending", () => {
    const ps = [p({ kind: "deposit", status: "succeeded" }), p({ kind: "balance", status: "pending" })];
    expect(derivedStatus(lc("active"), ps, NOW)).toBe("deposit_paid");
  });

  it("returns overdue when deposit succeeded and balance expired past its due date", () => {
    const ps = [
      p({ kind: "deposit", status: "succeeded" }),
      p({ kind: "balance", status: "expired", dueAt: NOW - 1 }),
    ];
    expect(derivedStatus(lc("active"), ps, NOW)).toBe("overdue");
  });

  it("stays deposit_paid when balance expired but due date still future", () => {
    const ps = [
      p({ kind: "deposit", status: "succeeded" }),
      p({ kind: "balance", status: "expired", dueAt: NOW + 86_400_000 }),
    ];
    expect(derivedStatus(lc("active"), ps, NOW)).toBe("deposit_paid");
  });

  it("returns refunded whenever any payment is refunded", () => {
    expect(derivedStatus(lc("active"), [p({ kind: "full", status: "refunded" })], NOW)).toBe("refunded");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- participant-status`
Expected: import errors / file not found for `./participant-status`.

- [ ] **Step 3: Implement `derivedStatus`**

Create `src/lib/participant-status.ts`:

```ts
export type PaymentKind = "full" | "deposit" | "balance";
export type PaymentStatus = "pending" | "succeeded" | "expired" | "failed" | "refunded";
export type LifecycleStatus = "active" | "waitlisted" | "cancelled";

export type DerivedStatus =
  | "pending"
  | "paid"
  | "deposit_paid"
  | "overdue"
  | "refunded"
  | "cancelled"
  | "waitlisted";

export type PaymentLike = {
  kind: PaymentKind;
  status: PaymentStatus;
  dueAt: number | null;
};

export type ParticipantLike = {
  lifecycleStatus: LifecycleStatus;
};

export function derivedStatus(
  participant: ParticipantLike,
  payments: PaymentLike[],
  nowMs: number,
): DerivedStatus {
  if (participant.lifecycleStatus === "waitlisted") return "waitlisted";
  if (participant.lifecycleStatus === "cancelled") return "cancelled";

  if (payments.some((p) => p.status === "refunded")) return "refunded";
  if (payments.some((p) => p.status === "pending")) return "pending";

  const succeeded = payments.filter((p) => p.status === "succeeded");
  const hasFullSucceeded = succeeded.some((p) => p.kind === "full");
  const hasDepositSucceeded = succeeded.some((p) => p.kind === "deposit");
  const hasBalanceSucceeded = succeeded.some((p) => p.kind === "balance");

  if (hasFullSucceeded) return "paid";
  if (hasDepositSucceeded && hasBalanceSucceeded) return "paid";

  if (hasDepositSucceeded) {
    const balance = payments.find((p) => p.kind === "balance");
    if (!balance) return "deposit_paid";
    if (balance.status === "pending") return "deposit_paid";
    // balance is expired or failed
    if (balance.dueAt !== null && balance.dueAt <= nowMs) return "overdue";
    return "deposit_paid";
  }

  return "cancelled";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- participant-status`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/participant-status.ts src/lib/participant-status.test.ts
git commit -m "feat(participants): derivedStatus pure function + tests"
```

### Task A4: Write `payments` query module

**Files:**
- Create: `src/lib/db/queries/payments.ts`

- [ ] **Step 1: Implement the queries**

Create `src/lib/db/queries/payments.ts`:

```ts
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { NewPayment, Payment } from "@/lib/db/schema";

export async function insertPayment(row: NewPayment): Promise<void> {
  const db = getDb();
  await db.insert(schema.payments).values(row);
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const db = getDb();
  const rows = await db.select().from(schema.payments).where(eq(schema.payments.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getPaymentByStripeSession(sessionId: string): Promise<Payment | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.stripeSessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPaymentByStripePaymentIntent(pi: string): Promise<Payment | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.stripePaymentIntentId, pi))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPaymentsForParticipant(participantId: string): Promise<Payment[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.participantId, participantId))
    .all();
}

export async function listPaymentsForParticipants(ids: string[]): Promise<Payment[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.payments)
    .where(inArray(schema.payments.participantId, ids))
    .all();
}

export async function setPaymentStripeSession(paymentId: string, sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ stripeSessionId: sessionId, updatedAt: Date.now() })
    .where(eq(schema.payments.id, paymentId));
}

export async function markPaymentSucceededIfPending(params: {
  paymentId: string;
  stripePaymentIntentId: string;
  amountCents: number;
  applicationFeeCents: number | null;
  paidAt: number;
}): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(schema.payments)
    .set({
      status: "succeeded",
      stripePaymentIntentId: params.stripePaymentIntentId,
      amountCents: params.amountCents,
      stripeApplicationFee: params.applicationFeeCents,
      paidAt: params.paidAt,
      expiresAt: null,
      updatedAt: Date.now(),
    })
    .where(and(eq(schema.payments.id, params.paymentId), eq(schema.payments.status, "pending")))
    .returning({ id: schema.payments.id });
  return updated.length > 0;
}

export async function markPaymentExpiredIfPending(paymentId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "expired", updatedAt: Date.now() })
    .where(and(eq(schema.payments.id, paymentId), eq(schema.payments.status, "pending")));
}

export async function markPaymentFailedIfPending(paymentId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "failed", updatedAt: Date.now() })
    .where(and(eq(schema.payments.id, paymentId), eq(schema.payments.status, "pending")));
}

export async function markPaymentRefunded(paymentIntentId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "refunded", updatedAt: Date.now() })
    .where(eq(schema.payments.stripePaymentIntentId, paymentIntentId));
}

export async function setPaymentLastReminderAt(paymentId: string, at: number): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ lastReminderAt: at, updatedAt: Date.now() })
    .where(eq(schema.payments.id, paymentId));
}

export async function setBalanceDueAtForPayment(paymentId: string, at: number): Promise<void> {
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ dueAt: at, updatedAt: Date.now() })
    .where(eq(schema.payments.id, paymentId));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/queries/payments.ts
git commit -m "feat(db): payments query module"
```

### Task A5: Rewrite capacity to use payments + derived status

**Files:**
- Modify: `src/lib/capacity.ts`
- Modify: `src/lib/capacity.test.ts`

- [ ] **Step 1: Rewrite the failing test**

Read `src/lib/capacity.test.ts` (existing) to preserve the external contract, then replace it with:

```ts
import { describe, it, expect } from "vitest";
import { computeSpotsTaken } from "./capacity";
import type { ParticipantLike, PaymentLike } from "./participant-status";

type Row = { participant: ParticipantLike; payments: PaymentLike[] };

const NOW = 1_000_000_000_000;

const lc = (s: ParticipantLike["lifecycleStatus"]): ParticipantLike => ({ lifecycleStatus: s });
const pay = (over: Partial<PaymentLike> = {}): PaymentLike => ({
  kind: "full",
  status: "pending",
  dueAt: null,
  ...over,
});

describe("computeSpotsTaken", () => {
  it("counts pending, deposit_paid, paid, and overdue", () => {
    const rows: Row[] = [
      { participant: lc("active"), payments: [pay({ status: "pending" })] },                                 // pending
      { participant: lc("active"), payments: [pay({ kind: "deposit", status: "succeeded" })] },              // deposit_paid
      { participant: lc("active"), payments: [pay({ kind: "full", status: "succeeded" })] },                 // paid
      {
        participant: lc("active"),
        payments: [
          pay({ kind: "deposit", status: "succeeded" }),
          pay({ kind: "balance", status: "expired", dueAt: NOW - 1 }),
        ],
      }, // overdue
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(4);
  });

  it("does not count waitlisted, cancelled, refunded", () => {
    const rows: Row[] = [
      { participant: lc("waitlisted"), payments: [] },
      { participant: lc("cancelled"), payments: [pay({ status: "succeeded" })] },
      { participant: lc("active"), payments: [pay({ status: "refunded" })] },
      { participant: lc("active"), payments: [pay({ status: "expired" })] }, // derives to cancelled
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- capacity`
Expected: fails — existing `computeSpotsTaken` has the old signature.

- [ ] **Step 3: Rewrite capacity.ts**

Replace the file contents with:

```ts
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  derivedStatus,
  type DerivedStatus,
  type ParticipantLike,
  type PaymentLike,
} from "@/lib/participant-status";

const TAKEN: DerivedStatus[] = ["pending", "deposit_paid", "paid", "overdue"];

export function computeSpotsTaken(
  rows: { participant: ParticipantLike; payments: PaymentLike[] }[],
  nowMs: number,
): number {
  return rows.filter((r) => TAKEN.includes(derivedStatus(r.participant, r.payments, nowMs))).length;
}

export async function countTakenSpots(eventId: string, nowMs: number): Promise<number> {
  const db = getDb();
  const participantRows = await db
    .select({
      id: schema.participants.id,
      lifecycleStatus: schema.participants.lifecycleStatus,
    })
    .from(schema.participants)
    .where(eq(schema.participants.eventId, eventId));

  if (participantRows.length === 0) return 0;

  const paymentRows = await db
    .select({
      participantId: schema.payments.participantId,
      kind: schema.payments.kind,
      status: schema.payments.status,
      dueAt: schema.payments.dueAt,
    })
    .from(schema.payments)
    .where(
      // all payments for the participants of this event
      eq(schema.payments.participantId, schema.participants.id),
    );
  // ^ drizzle doesn't support correlated subqueries like this cleanly; fall back to a join:

  // Replace the above with a simple in-memory group-by: load all payments for participants and bucket them.
  const byParticipant = new Map<string, { kind: string; status: string; dueAt: number | null }[]>();
  const allPayments = await db
    .select({
      participantId: schema.payments.participantId,
      kind: schema.payments.kind,
      status: schema.payments.status,
      dueAt: schema.payments.dueAt,
    })
    .from(schema.payments);
  for (const pr of allPayments) {
    const list = byParticipant.get(pr.participantId) ?? [];
    list.push({ kind: pr.kind, status: pr.status, dueAt: pr.dueAt });
    byParticipant.set(pr.participantId, list);
  }

  const rows = participantRows.map((p) => ({
    participant: { lifecycleStatus: p.lifecycleStatus as ParticipantLike["lifecycleStatus"] },
    payments: (byParticipant.get(p.id) ?? []).map((pm) => ({
      kind: pm.kind as PaymentLike["kind"],
      status: pm.status as PaymentLike["status"],
      dueAt: pm.dueAt,
    })),
  }));

  return computeSpotsTaken(rows, nowMs);
}
```

**Note:** the "load all payments" approach is fine for MVP scale (tens to hundreds per event). Optimize later with a proper join if needed — do not pre-optimize now. Replace with a drizzle `innerJoin` when convenient:

Actually use an inner join to scope loads to the event. Replace the function body with:

```ts
export async function countTakenSpots(eventId: string, nowMs: number): Promise<number> {
  const db = getDb();

  const participantRows = await db
    .select({ id: schema.participants.id, lifecycleStatus: schema.participants.lifecycleStatus })
    .from(schema.participants)
    .where(eq(schema.participants.eventId, eventId));
  if (participantRows.length === 0) return 0;

  const paymentRows = await db
    .select({
      participantId: schema.payments.participantId,
      kind: schema.payments.kind,
      status: schema.payments.status,
      dueAt: schema.payments.dueAt,
    })
    .from(schema.payments)
    .innerJoin(schema.participants, eq(schema.payments.participantId, schema.participants.id))
    .where(eq(schema.participants.eventId, eventId));

  const byParticipant = new Map<string, PaymentLike[]>();
  for (const pr of paymentRows) {
    const list = byParticipant.get(pr.participantId) ?? [];
    list.push({
      kind: pr.kind as PaymentLike["kind"],
      status: pr.status as PaymentLike["status"],
      dueAt: pr.dueAt,
    });
    byParticipant.set(pr.participantId, list);
  }

  const rows = participantRows.map((p) => ({
    participant: { lifecycleStatus: p.lifecycleStatus as ParticipantLike["lifecycleStatus"] },
    payments: byParticipant.get(p.id) ?? [],
  }));
  return computeSpotsTaken(rows, nowMs);
}
```

Use the second (inner-join) version as the final implementation — delete the first draft.

- [ ] **Step 4: Run tests**

Run: `npm test -- capacity`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capacity.ts src/lib/capacity.test.ts
git commit -m "feat(capacity): use payments + derivedStatus for spot counting"
```

### Task A6: Update participants queries to the new schema

**Files:**
- Modify: `src/lib/db/queries/participants.ts`

- [ ] **Step 1: Rewrite the module**

Replace the file contents with:

```ts
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { NewParticipant, Participant } from "@/lib/db/schema";

export async function insertParticipant(row: NewParticipant): Promise<void> {
  const db = getDb();
  await db.insert(schema.participants).values(row);
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listParticipantsForEvent(eventId: string): Promise<Participant[]> {
  const db = getDb();
  return db.select().from(schema.participants).where(eq(schema.participants.eventId, eventId)).all();
}

export async function listParticipantsByEmail(email: string): Promise<Participant[]> {
  const db = getDb();
  return db.select().from(schema.participants).where(eq(schema.participants.email, email)).all();
}

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

export async function getParticipantWithContext(participantId: string) {
  const db = getDb();
  const rows = await db
    .select({
      participant: schema.participants,
      event: schema.events,
      organizer: schema.organizers,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(eq(schema.participants.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/queries/participants.ts
git commit -m "feat(db): migrate participants queries to lifecycleStatus + payments"
```

### Task A7: Rewrite the webhook handler for payments

**Files:**
- Modify: `src/lib/webhook-handler.ts`
- Create: `src/lib/webhook-handler.test.ts` (if not present — existing file may be updated)

- [ ] **Step 1: Read the current test file**

Run: `ls src/lib/webhook-handler.test.ts` to check if it exists. If it does, read it and rewrite. If not, create new.

- [ ] **Step 2: Write the failing test**

Replace `src/lib/webhook-handler.test.ts` with:

```ts
import { describe, it, expect, vi } from "vitest";
import { handleStripeEvent, type WebhookDeps } from "./webhook-handler";
import type Stripe from "stripe";

const deps = () => {
  const calls = {
    succeed: vi.fn(async () => true),
    expire: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
    refund: vi.fn(async () => {}),
    onboardingUpdate: vi.fn(async () => {}),
    now: vi.fn(() => 42),
  };
  const d: WebhookDeps = {
    markPaymentSucceeded: calls.succeed,
    markPaymentExpired: calls.expire,
    markPaymentFailed: calls.fail,
    markPaymentRefunded: calls.refund,
    syncOrganizerFromAccount: calls.onboardingUpdate,
    now: calls.now,
  };
  return { d, calls };
};

const evt = <T extends Stripe.Event["type"]>(type: T, data: object, account?: string): Stripe.Event =>
  ({
    type,
    account,
    data: { object: data as never },
  }) as Stripe.Event;

describe("handleStripeEvent", () => {
  it("updates payment on checkout.session.completed", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.completed", {
        metadata: { payment_id: "pay_1" },
        payment_intent: "pi_1",
        amount_total: 1234,
      }),
      d,
    );
    expect(calls.succeed).toHaveBeenCalledWith({
      paymentId: "pay_1",
      stripePaymentIntentId: "pi_1",
      amountCents: 1234,
      applicationFeeCents: null,
      paidAt: 42,
    });
  });

  it("expires payment on session.expired", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.expired", { metadata: { payment_id: "pay_1" } }),
      d,
    );
    expect(calls.expire).toHaveBeenCalledWith("pay_1");
  });

  it("fails payment on payment_intent.payment_failed", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("payment_intent.payment_failed", { metadata: { payment_id: "pay_1" } }),
      d,
    );
    expect(calls.fail).toHaveBeenCalledWith("pay_1");
  });

  it("refunds by payment_intent on charge.refunded", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("charge.refunded", { payment_intent: "pi_9" }),
      d,
    );
    expect(calls.refund).toHaveBeenCalledWith("pi_9");
  });

  it("syncs organizer on account.updated", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("account.updated", {
        id: "acct_1",
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
      }),
      d,
    );
    expect(calls.onboardingUpdate).toHaveBeenCalledWith({
      accountId: "acct_1",
      onboardingComplete: true,
      payoutsEnabled: true,
    });
  });

  it("ignores events without payment_id metadata", async () => {
    const { d, calls } = deps();
    await handleStripeEvent(
      evt("checkout.session.completed", { metadata: {}, payment_intent: "pi_1", amount_total: 10 }),
      d,
    );
    expect(calls.succeed).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `npm test -- webhook-handler`
Expected: import/type errors — deps shape has changed.

- [ ] **Step 4: Rewrite webhook-handler.ts**

Replace file contents with:

```ts
import type Stripe from "stripe";

export type WebhookDeps = {
  markPaymentSucceeded(params: {
    paymentId: string;
    stripePaymentIntentId: string;
    amountCents: number;
    applicationFeeCents: number | null;
    paidAt: number;
  }): Promise<boolean>;
  markPaymentExpired(paymentId: string): Promise<void>;
  markPaymentFailed(paymentId: string): Promise<void>;
  markPaymentRefunded(paymentIntentId: string): Promise<void>;
  syncOrganizerFromAccount(params: {
    accountId: string;
    onboardingComplete: boolean;
    payoutsEnabled: boolean;
  }): Promise<void>;
  now(): number;
};

function paymentIdFromMetadata(meta: Stripe.Metadata | null | undefined): string | null {
  if (!meta) return null;
  const v = meta.payment_id;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const paymentId = paymentIdFromMetadata(s.metadata);
      if (!paymentId) return;
      const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? "";
      await deps.markPaymentSucceeded({
        paymentId,
        stripePaymentIntentId: pi,
        amountCents: s.amount_total ?? 0,
        applicationFeeCents: null,
        paidAt: deps.now(),
      });
      return;
    }
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const paymentId = paymentIdFromMetadata(s.metadata);
      if (!paymentId) return;
      await deps.markPaymentExpired(paymentId);
      return;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentId = paymentIdFromMetadata(pi.metadata);
      if (!paymentId) return;
      await deps.markPaymentFailed(paymentId);
      return;
    }
    case "charge.refunded": {
      const ch = event.data.object as Stripe.Charge;
      const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (!pi) return;
      await deps.markPaymentRefunded(pi);
      return;
    }
    case "account.updated": {
      const a = event.data.object as Stripe.Account;
      await deps.syncOrganizerFromAccount({
        accountId: a.id,
        onboardingComplete: Boolean(a.details_submitted) && Boolean(a.charges_enabled),
        payoutsEnabled: Boolean(a.payouts_enabled),
      });
      return;
    }
    default:
      return;
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- webhook-handler`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/webhook-handler.ts src/lib/webhook-handler.test.ts
git commit -m "feat(webhook): handler operates on payments + handles Connect events"
```

### Task A8: Rewrite `processRegistration` to create payment rows

**Files:**
- Modify: `src/lib/register/process-registration.ts`

- [ ] **Step 1: Rewrite the function**

Replace the file's body (keep imports of `registrationBaseSchema`, `CustomQuestion`, `zodIssuesToRecord`, etc., update as needed):

```ts
import { headers } from "next/headers";
import { registrationBaseSchema } from "@/lib/validators/registration";
import type { CustomQuestion } from "@/lib/validators/event";
import { zodIssuesToRecord } from "@/lib/zod-errors";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";
import { insertParticipant } from "@/lib/db/queries/participants";
import { insertPayment, setPaymentStripeSession } from "@/lib/db/queries/payments";
import { newId } from "@/lib/ids";
import { getStripe } from "@/lib/stripe";
import {
  sendWaitlistConfirmation,
  sendOrganizerNewRegistration,
} from "@/lib/email/send";
import { dashboardEventUrl } from "@/lib/urls";

const DEPOSIT_PENDING_TTL_MS = 30 * 60 * 1000;

export type RegistrationProcessResult =
  | { redirectUrl: string }
  | { errors: Record<string, string> };

async function eventSiteOrigin(subdomain: string, requestProtocol?: string) {
  const rootHost = subdomain + "." + (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000");
  let proto = requestProtocol;
  if (!proto) {
    const h = await headers();
    const p = h.get("x-forwarded-proto") ?? "http";
    proto = p.endsWith(":") ? p : `${p}:`;
  }
  return `${proto}//${rootHost}`;
}

export async function processRegistration(
  form: FormData,
  requestProtocol?: string,
): Promise<RegistrationProcessResult> {
  const parsed = registrationBaseSchema.safeParse({
    eventId: form.get("eventId"),
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    email: form.get("email"),
    phone: form.get("phone") || undefined,
  });
  if (!parsed.success) return { errors: zodIssuesToRecord(parsed.error.issues) };

  const subdomain = String(form.get("organizerSubdomain") ?? "");
  const slug = String(form.get("eventSlug") ?? "");
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) return { errors: { _form: "Nie znaleziono organizatora." } };

  if (!organizer.stripeAccountId || organizer.stripeOnboardingComplete !== 1 || organizer.stripePayoutsEnabled !== 1) {
    return { errors: { _form: "Rejestracja chwilowo niedostępna." } };
  }

  const event = await getPublishedEventBySlug(organizer.id, slug);
  if (!event || event.id !== parsed.data.eventId) {
    return { errors: { _form: "Nie znaleziono wydarzenia." } };
  }

  const questions: CustomQuestion[] = event.customQuestions ? JSON.parse(event.customQuestions) : [];
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const v = form.get(`q_${q.id}`);
    if (q.required && (!v || String(v).trim() === "")) errors[`q_${q.id}`] = "To pole jest wymagane.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const answers: Record<string, string> = {};
  for (const q of questions) {
    const v = form.get(`q_${q.id}`);
    if (v) answers[q.id] = String(v);
  }

  const now = Date.now();
  const taken = await countTakenSpots(event.id, now);
  const isFull = taken >= event.capacity;

  const participantId = newId();
  const origin = await eventSiteOrigin(subdomain, requestProtocol);

  if (isFull) {
    await insertParticipant({
      id: participantId,
      eventId: event.id,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      customAnswers: JSON.stringify(answers),
      lifecycleStatus: "waitlisted",
      createdAt: now,
      updatedAt: now,
    });

    const emailPromises: Promise<void>[] = [
      sendWaitlistConfirmation({
        to: parsed.data.email,
        participantName: parsed.data.firstName,
        eventTitle: event.title,
        eventUrl: `${origin}/${slug}`,
        organizerName: organizer.displayName,
      }),
    ];
    if (organizer.contactEmail) {
      emailPromises.push(
        sendOrganizerNewRegistration({
          to: organizer.contactEmail,
          participantName: `${parsed.data.firstName} ${parsed.data.lastName}`,
          participantEmail: parsed.data.email,
          eventTitle: event.title,
          spotsInfo: `${taken} / ${event.capacity} (pełne)`,
          isWaitlisted: true,
          dashboardUrl: dashboardEventUrl(event.id),
        }),
      );
    }
    Promise.allSettled(emailPromises).catch(() => {});

    return { redirectUrl: `${origin}/${slug}/thanks?waitlisted=1` };
  }

  await insertParticipant({
    id: participantId,
    eventId: event.id,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    customAnswers: JSON.stringify(answers),
    lifecycleStatus: "active",
    createdAt: now,
    updatedAt: now,
  });

  // Deposit-mode event? Create a 'deposit' payment; otherwise 'full'.
  const depositMode = event.depositCents != null && event.depositCents > 0 && event.depositCents < event.priceCents;
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
    expiresAt: now + DEPOSIT_PENDING_TTL_MS,
    createdAt: now,
    updatedAt: now,
  });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: parsed.data.email,
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
      success_url: `${origin}/${slug}/thanks?pid=${participantId}`,
      cancel_url: `${origin}/${slug}/register`,
      expires_at: Math.floor((now + DEPOSIT_PENDING_TTL_MS) / 1000),
    },
    { stripeAccount: organizer.stripeAccountId },
  );

  await setPaymentStripeSession(paymentId, session.id);

  if (!session.url) {
    return { errors: { _form: "Nie udało się utworzyć sesji płatności." } };
  }
  return { redirectUrl: session.url };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/register/process-registration.ts
git commit -m "feat(register): create payment row + direct charge on connected account"
```

### Task A9: Update the Stripe webhook route handlers

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`
- Create: `src/app/api/stripe/connect-webhook/route.ts`

- [ ] **Step 1: Rewrite the platform webhook route**

Replace `src/app/api/stripe/webhook/route.ts` with:

```ts
import { NextRequest } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/webhook-handler";
import {
  markPaymentSucceededIfPending,
  markPaymentExpiredIfPending,
  markPaymentFailedIfPending,
  markPaymentRefunded,
  getPaymentById,
} from "@/lib/db/queries/payments";
import { getParticipantWithContext } from "@/lib/db/queries/participants";
import { syncOrganizerStripeState } from "@/lib/db/queries/organizers";
import { sendPaymentConfirmation, sendOrganizerNewRegistration } from "@/lib/email/send";
import { dashboardEventUrl, publicEventUrl } from "@/lib/urls";
import { countTakenSpots } from "@/lib/capacity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const body = await req.text();

  const stripe = getStripe();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, getWebhookSecret());
  } catch (err) {
    console.error("webhook signature verification failed", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event, {
      markPaymentSucceeded: async (params) => {
        const transitioned = await markPaymentSucceededIfPending(params);
        if (!transitioned) return false;

        const payment = await getPaymentById(params.paymentId);
        if (!payment) return true;
        const ctx = await getParticipantWithContext(payment.participantId);
        if (!ctx) return true;

        const dateStr = new Date(ctx.event.startsAt).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const emailPromises: Promise<void>[] = [
          sendPaymentConfirmation({
            to: ctx.participant.email,
            participantName: ctx.participant.firstName,
            eventTitle: ctx.event.title,
            eventDate: dateStr,
            eventLocation: ctx.event.location,
            eventUrl: publicEventUrl(ctx.organizer.subdomain, ctx.event.slug),
            organizerName: ctx.organizer.displayName,
            paymentKind: payment.kind,
            amountCents: payment.amountCents,
          }),
        ];

        if (ctx.organizer.contactEmail) {
          const taken = await countTakenSpots(ctx.event.id, Date.now());
          emailPromises.push(
            sendOrganizerNewRegistration({
              to: ctx.organizer.contactEmail,
              participantName: `${ctx.participant.firstName} ${ctx.participant.lastName}`,
              participantEmail: ctx.participant.email,
              eventTitle: ctx.event.title,
              spotsInfo: `${taken} / ${ctx.event.capacity}`,
              isWaitlisted: false,
              dashboardUrl: dashboardEventUrl(ctx.event.id),
            }),
          );
        }

        await Promise.allSettled(emailPromises);
        return true;
      },
      markPaymentExpired: markPaymentExpiredIfPending,
      markPaymentFailed: markPaymentFailedIfPending,
      markPaymentRefunded: markPaymentRefunded,
      syncOrganizerFromAccount: syncOrganizerStripeState,
      now: () => Date.now(),
    });
  } catch (err) {
    console.error("webhook processing error", err);
    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 2: Create the Connect webhook route**

Create `src/app/api/stripe/connect-webhook/route.ts` with identical body to the platform webhook, but reading a different secret. Extract the common handler body into a helper to avoid duplication.

First, create `src/lib/stripe-webhook-handler-deps.ts` (to DRY the deps):

```ts
import {
  markPaymentSucceededIfPending,
  markPaymentExpiredIfPending,
  markPaymentFailedIfPending,
  markPaymentRefunded,
  getPaymentById,
} from "@/lib/db/queries/payments";
import { getParticipantWithContext } from "@/lib/db/queries/participants";
import { syncOrganizerStripeState } from "@/lib/db/queries/organizers";
import { sendPaymentConfirmation, sendOrganizerNewRegistration } from "@/lib/email/send";
import { dashboardEventUrl, publicEventUrl } from "@/lib/urls";
import { countTakenSpots } from "@/lib/capacity";
import type { WebhookDeps } from "@/lib/webhook-handler";

export function buildWebhookDeps(): WebhookDeps {
  return {
    markPaymentSucceeded: async (params) => {
      const transitioned = await markPaymentSucceededIfPending(params);
      if (!transitioned) return false;
      const payment = await getPaymentById(params.paymentId);
      if (!payment) return true;
      const ctx = await getParticipantWithContext(payment.participantId);
      if (!ctx) return true;

      const dateStr = new Date(ctx.event.startsAt).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const emailPromises: Promise<void>[] = [
        sendPaymentConfirmation({
          to: ctx.participant.email,
          participantName: ctx.participant.firstName,
          eventTitle: ctx.event.title,
          eventDate: dateStr,
          eventLocation: ctx.event.location,
          eventUrl: publicEventUrl(ctx.organizer.subdomain, ctx.event.slug),
          organizerName: ctx.organizer.displayName,
          paymentKind: payment.kind,
          amountCents: payment.amountCents,
        }),
      ];

      if (ctx.organizer.contactEmail) {
        const taken = await countTakenSpots(ctx.event.id, Date.now());
        emailPromises.push(
          sendOrganizerNewRegistration({
            to: ctx.organizer.contactEmail,
            participantName: `${ctx.participant.firstName} ${ctx.participant.lastName}`,
            participantEmail: ctx.participant.email,
            eventTitle: ctx.event.title,
            spotsInfo: `${taken} / ${ctx.event.capacity}`,
            isWaitlisted: false,
            dashboardUrl: dashboardEventUrl(ctx.event.id),
          }),
        );
      }

      await Promise.allSettled(emailPromises);
      return true;
    },
    markPaymentExpired: markPaymentExpiredIfPending,
    markPaymentFailed: markPaymentFailedIfPending,
    markPaymentRefunded: markPaymentRefunded,
    syncOrganizerFromAccount: syncOrganizerStripeState,
    now: () => Date.now(),
  };
}
```

Then update the signature of `WebhookDeps.markPaymentSucceeded` in `src/lib/webhook-handler.ts` to return `Promise<boolean>` (already set in Task A7) — confirm it matches.

Now create `src/app/api/stripe/connect-webhook/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleStripeEvent } from "@/lib/webhook-handler";
import { buildWebhookDeps } from "@/lib/stripe-webhook-handler-deps";

export const dynamic = "force-dynamic";

function getConnectWebhookSecret(): string {
  const { env } = getCloudflareContext();
  const s = (env as unknown as { STRIPE_CONNECT_WEBHOOK_SECRET?: string }).STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!s) throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET not set");
  return s;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const body = await req.text();

  const stripe = getStripe();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, getConnectWebhookSecret());
  } catch (err) {
    console.error("connect webhook signature verification failed", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event, buildWebhookDeps());
  } catch (err) {
    console.error("connect webhook processing error", err);
    return new Response("ok", { status: 200 });
  }
  return new Response("ok", { status: 200 });
}
```

Update the platform webhook route (`src/app/api/stripe/webhook/route.ts`) to use `buildWebhookDeps()` instead of inlining:

```ts
import { NextRequest } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/webhook-handler";
import { buildWebhookDeps } from "@/lib/stripe-webhook-handler-deps";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const body = await req.text();

  const stripe = getStripe();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, getWebhookSecret());
  } catch (err) {
    console.error("webhook signature verification failed", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event, buildWebhookDeps());
  } catch (err) {
    console.error("webhook processing error", err);
    return new Response("ok", { status: 200 });
  }
  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 3: Wire the new secret in wrangler.jsonc and .dev.vars**

Add to `.dev.vars` (local only, do NOT commit): `STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...` (get from Stripe Dashboard when you create the endpoint).

Add the TypeScript binding: run `npm run cf-typegen` to regenerate `cloudflare-env.d.ts` after setting the secret via `wrangler secret put STRIPE_CONNECT_WEBHOOK_SECRET` (do this later during manual verification). For now, cast in code is acceptable.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts src/app/api/stripe/connect-webhook/route.ts src/lib/stripe-webhook-handler-deps.ts
git commit -m "feat(webhooks): split platform and Connect endpoints sharing deps"
```

### Task A10: Rewrite `syncOrganizerStripeState` and add missing organizer queries

**Files:**
- Modify: `src/lib/db/queries/organizers.ts`

- [ ] **Step 1: Read current file**

Read `src/lib/db/queries/organizers.ts` to preserve existing exports (e.g., `getOrganizerBySubdomain`, whichever others are used).

- [ ] **Step 2: Add the new functions**

Append (do not remove existing exports):

```ts
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export async function setOrganizerStripeAccountId(organizerId: string, accountId: string) {
  const db = getDb();
  await db
    .update(schema.organizers)
    .set({ stripeAccountId: accountId, stripeAccountSyncedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(schema.organizers.id, organizerId));
}

export async function syncOrganizerStripeState(params: {
  accountId: string;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
}) {
  const db = getDb();
  await db
    .update(schema.organizers)
    .set({
      stripeOnboardingComplete: params.onboardingComplete ? 1 : 0,
      stripePayoutsEnabled: params.payoutsEnabled ? 1 : 0,
      stripeAccountSyncedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(schema.organizers.stripeAccountId, params.accountId));
}

export async function getOrganizerByStripeAccount(accountId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.organizers)
    .where(eq(schema.organizers.stripeAccountId, accountId))
    .limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries/organizers.ts
git commit -m "feat(db): organizer queries for Stripe Connect state"
```

### Task A11: Update email template for payment confirmation

**Files:**
- Modify: `src/lib/email/send.ts`
- Modify: `src/lib/email/templates.ts`

- [ ] **Step 1: Replace `sendRegistrationConfirmation` with `sendPaymentConfirmation`**

Search: `grep -rn sendRegistrationConfirmation src`. Update callers to import `sendPaymentConfirmation`.

In `src/lib/email/send.ts`, add:

```ts
export async function sendPaymentConfirmation(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string | null;
  eventUrl: string;
  organizerName: string;
  paymentKind: "full" | "deposit" | "balance";
  amountCents: number;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: paymentConfirmedSubject(params.eventTitle, params.paymentKind),
    html: paymentConfirmedHtml(params),
  });
}
```

Remove the old `sendRegistrationConfirmation` once all call sites updated.

In `src/lib/email/templates.ts`, add `paymentConfirmedSubject` and `paymentConfirmedHtml` that branch copy on `paymentKind`:
- `full` → "Potwierdzenie płatności — {eventTitle}"
- `deposit` → "Potwierdzenie zaliczki — {eventTitle}" (body also mentions that full balance will be required by {balance_due_at}; if we don't have it in params, keep copy generic)
- `balance` → "Potwierdzenie pełnej płatności — {eventTitle}"

HTML body: simple inline-styled layout with amount `(amountCents/100) zł`, event name, date, location, organizer name. Follow the style of existing `registrationConfirmedHtml`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/email/send.ts src/lib/email/templates.ts src/app/api/stripe/webhook/route.ts src/lib/stripe-webhook-handler-deps.ts
git commit -m "feat(email): payment confirmation template with kind-aware copy"
```

### Task A12: Fix all remaining TS compile errors from the refactor

**Files:**
- Modify: whatever `tsc --noEmit` lists

- [ ] **Step 1: Identify remaining errors**

Run: `npx tsc --noEmit`
Expected: list of files still referencing old fields (`participants.status`, `stripeSessionId` on participants, `amount_paid_cents`, etc.).

Likely spots:
- `src/lib/db/queries/events-dashboard.ts`
- `src/lib/db/queries/finance.ts`
- `src/app/dashboard/events/[id]/page.tsx` and subpages
- `src/app/dashboard/finance/page.tsx`
- `src/app/api/cron/cleanup-pending/route.ts`
- `src/lib/csv.ts` (CSV export reads participant fields)
- `src/app/sites/[subdomain]/[eventSlug]/thanks/page.tsx`

- [ ] **Step 2: Fix each**

For each file, replace the old fields with either:
- `lifecycleStatus` for the stored lifecycle
- Queries against `payments` for amount/paid_at/session info

For `cleanup-pending/route.ts`, change the query from participant pending expiry to payment pending expiry:

```ts
import { and, eq, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export async function GET() {
  const now = Date.now();
  const db = getDb();
  await db
    .update(schema.payments)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(schema.payments.status, "pending"), lt(schema.payments.expiresAt, now)));
  return new Response("ok");
}
```

For CSV export and dashboard participant tables, load payments alongside participants, compute derived status, and render.

- [ ] **Step 3: Run tests + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: both clean.

- [ ] **Step 4: Apply migration locally and smoke-test**

Run: `npm run db:migrate:local`
Expected: migration `0001_payments_connect` applied.

Run: `npm run dev`
- Sign up an organizer.
- Attempt to create an event and publish — should be blocked because Stripe Connect not yet set up (we added the `stripeAccountId` guard in `processRegistration`). You may need to manually SQL-update `stripe_onboarding_complete=1` and `stripe_payouts_enabled=1` and set a fake `stripe_account_id` to confirm the registration path still creates a `payments` row. Verify `SELECT * FROM payments` shows a new row with `status='pending'`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: fan out payments-table changes across dashboard, csv, cron"
```

---

## Phase B — Stripe Connect Express onboarding

Organizers connect their Stripe account via the hosted Express flow. Publish gate lights up once onboarding completes.

### Task B1: Connect onboarding server actions

**Files:**
- Create: `src/lib/stripe-connect.ts`

- [ ] **Step 1: Implement the helpers**

```ts
"use server";

import { getStripe } from "@/lib/stripe";
import {
  setOrganizerStripeAccountId,
  syncOrganizerStripeState,
  getOrganizerByStripeAccount,
} from "@/lib/db/queries/organizers";
import type Stripe from "stripe";

export async function createConnectAccountAndLink(params: {
  organizerId: string;
  organizerEmail: string | null;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();

  const account = await stripe.accounts.create({
    type: "express",
    country: "PL",
    email: params.organizerEmail ?? undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
      blik_payments: { requested: true },
      p24_payments: { requested: true },
    },
    settings: { payouts: { schedule: { interval: "manual" } } },
    metadata: { organizer_id: params.organizerId },
  });

  await setOrganizerStripeAccountId(params.organizerId, account.id);

  const link = await stripe.accountLinks.create({
    account: account.id,
    type: "account_onboarding",
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
  });

  return { url: link.url };
}

export async function refreshOnboardingLink(params: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: params.accountId,
    type: "account_onboarding",
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
  });
  return { url: link.url };
}

export async function reconcileAccount(accountId: string): Promise<Stripe.Account> {
  const stripe = getStripe();
  const a = await stripe.accounts.retrieve(accountId);
  await syncOrganizerStripeState({
    accountId: a.id,
    onboardingComplete: Boolean(a.details_submitted) && Boolean(a.charges_enabled),
    payoutsEnabled: Boolean(a.payouts_enabled),
  });
  return a;
}

export async function createExpressLoginLink(accountId: string): Promise<{ url: string }> {
  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(accountId);
  return { url: link.url };
}

export async function isOrganizerOwnerOfAccount(organizerId: string, accountId: string): Promise<boolean> {
  const org = await getOrganizerByStripeAccount(accountId);
  return org?.id === organizerId;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stripe-connect.ts
git commit -m "feat(connect): account onboarding + reconcile + login-link helpers"
```

### Task B2: `/dashboard/onboarding/payouts` page

**Files:**
- Create: `src/app/dashboard/onboarding/payouts/page.tsx`
- Create: `src/app/dashboard/onboarding/payouts/return/page.tsx`

- [ ] **Step 1: Build the entry page**

Create `src/app/dashboard/onboarding/payouts/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { createConnectAccountAndLink, refreshOnboardingLink } from "@/lib/stripe-connect";

async function rootDomain() {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
}

async function startUrls() {
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  const host = await rootDomain();
  return {
    return: `${proto}//${host}/dashboard/onboarding/payouts/return`,
    refresh: `${proto}//${host}/dashboard/onboarding/payouts`,
  };
}

export default async function PayoutsOnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  if (organizer.stripeOnboardingComplete === 1 && organizer.stripePayoutsEnabled === 1) {
    redirect("/dashboard");
  }

  async function start() {
    "use server";
    const urls = await startUrls();
    if (!organizer) return;
    if (organizer.stripeAccountId) {
      const link = await refreshOnboardingLink({
        accountId: organizer.stripeAccountId,
        returnUrl: urls.return,
        refreshUrl: urls.refresh,
      });
      redirect(link.url);
    } else {
      const link = await createConnectAccountAndLink({
        organizerId: organizer.id,
        organizerEmail: organizer.contactEmail,
        returnUrl: urls.return,
        refreshUrl: urls.refresh,
      });
      redirect(link.url);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Skonfiguruj wypłaty</h1>
      <p>
        Aby publikować wydarzenia i przyjmować płatności, połącz konto Stripe.
        Wypłaty na Twoje konto bankowe uruchamiasz ręcznie, kiedy tego chcesz.
      </p>
      <form action={start}>
        <button type="submit" className="btn btn-primary">Połącz Stripe</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Build the return page**

Create `src/app/dashboard/onboarding/payouts/return/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { reconcileAccount, refreshOnboardingLink } from "@/lib/stripe-connect";

export default async function PayoutsReturnPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer || !organizer.stripeAccountId) redirect("/dashboard/onboarding/payouts");

  const account = await reconcileAccount(organizer.stripeAccountId);
  const complete = Boolean(account.details_submitted) && Boolean(account.charges_enabled) && Boolean(account.payouts_enabled);
  if (complete) redirect("/dashboard");

  async function resume() {
    "use server";
    const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
    const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
    if (!organizer?.stripeAccountId) return;
    const link = await refreshOnboardingLink({
      accountId: organizer.stripeAccountId,
      returnUrl: `${proto}//${host}/dashboard/onboarding/payouts/return`,
      refreshUrl: `${proto}//${host}/dashboard/onboarding/payouts`,
    });
    redirect(link.url);
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Jeszcze chwila</h1>
      <p>Stripe potrzebuje dodatkowych informacji, aby aktywować wypłaty.</p>
      <form action={resume}>
        <button type="submit" className="btn btn-primary">Kontynuuj w Stripe</button>
      </form>
      <p><Link href="/dashboard">Wróć do panelu</Link></p>
    </div>
  );
}
```

- [ ] **Step 3: Add dashboard banner for pending onboarding**

In `src/app/dashboard/page.tsx` (or a shared dashboard layout), if `organizer.stripeOnboardingComplete !== 1 || organizer.stripePayoutsEnabled !== 1`, show a yellow banner:

```tsx
{!onboardingComplete && (
  <div className="bg-yellow-100 border border-yellow-400 p-4 rounded">
    Dokończ konfigurację Stripe, aby móc publikować wydarzenia.{" "}
    <Link href="/dashboard/onboarding/payouts" className="underline">Konfiguruj</Link>
  </div>
)}
```

Place the read of `onboardingComplete` in the same server component.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/onboarding/payouts
git commit -m "feat(dashboard): Connect Express onboarding pages + banner"
```

### Task B3: Hard gate on event publish

**Files:**
- Modify: `src/lib/db/queries/events.ts` (or wherever the publish mutation lives)
- Modify: the event editor page where "Publish" action is wired

- [ ] **Step 1: Find the publish action**

Run: `grep -rn 'published' src/app/dashboard src/lib/db/queries` to locate the publish mutation.

- [ ] **Step 2: Gate it server-side**

In the publish server action, before writing `status='published'`:

```ts
const organizer = await getOrganizerByClerkUserId(userId);
if (!organizer || organizer.stripeOnboardingComplete !== 1 || organizer.stripePayoutsEnabled !== 1) {
  throw new Error("Stripe onboarding not complete — publish blocked.");
}
```

Additionally, disable the "Publish" button in the UI when onboarding is incomplete, and show tooltip/text "Dokończ konfigurację Stripe".

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(events): publish requires completed Stripe onboarding"
```

### Task B4: Manual end-to-end verification for Phase B

- [ ] **Step 1: Stripe test-mode setup**

In Stripe Dashboard (test mode):
1. Enable Connect.
2. Configure the Connect webhook endpoint: `https://<tunnel>/api/stripe/connect-webhook` subscribing to `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`.
3. Copy the signing secret → `wrangler secret put STRIPE_CONNECT_WEBHOOK_SECRET` for local dev, add to `.dev.vars`.

- [ ] **Step 2: Use a Cloudflare tunnel OR `stripe listen --forward-to`** for local webhook reception. For the Connect endpoint, add `--forward-connect-to` pointing at `/api/stripe/connect-webhook`.

- [ ] **Step 3: Walk the flow**

1. Sign up as a new organizer in the dashboard.
2. Click "Połącz Stripe" — you land on Stripe Express onboarding. Complete with test KYC data.
3. Return to the app — dashboard banner should disappear.
4. Create an event, publish — should succeed.
5. Register as a participant with price fully paid — Checkout Session opens on the *connected account* (check URL). Pay with test card.
6. Verify in DB: `payments` row flipped to `succeeded`, `stripe_payment_intent_id` populated.
7. Verify in Stripe Dashboard → Connected accounts → your test account: charge appears there, not on platform.

- [ ] **Step 4: Commit any follow-up fixes, tag the phase**

---

## Phase C — Deposit/balance event configuration and registration

### Task C1: Extend event validator and editor with deposit fields

**Files:**
- Modify: `src/lib/validators/event.ts`
- Modify: the event create/edit forms

- [ ] **Step 1: Update the zod schema**

Read `src/lib/validators/event.ts` first, then add:

```ts
import { z } from "zod";

export const eventFormSchema = z
  .object({
    // ...existing fields...
    priceCents: z.coerce.number().int().nonnegative(),
    depositCents: z.coerce.number().int().nonnegative().nullable().optional(),
    balanceDueAt: z.coerce.number().int().positive().nullable().optional(),
    startsAt: z.coerce.number().int(),
    endsAt: z.coerce.number().int(),
  })
  .refine(
    (v) => v.depositCents == null || v.depositCents === 0 || v.depositCents <= v.priceCents,
    { path: ["depositCents"], message: "Zaliczka nie może przekraczać ceny." },
  )
  .refine(
    (v) => v.depositCents == null || v.depositCents === 0 || v.depositCents === v.priceCents || v.balanceDueAt != null,
    { path: ["balanceDueAt"], message: "Podaj termin dopłaty, gdy zaliczka jest niższa niż cena." },
  )
  .refine(
    (v) => v.balanceDueAt == null || v.balanceDueAt < v.startsAt,
    { path: ["balanceDueAt"], message: "Termin dopłaty musi być przed rozpoczęciem." },
  );
```

Adjust to match the actual existing schema (do not break other fields).

- [ ] **Step 2: Add form fields in the event editor UI**

In the event create/edit page, add two fields:
- "Zaliczka (opcjonalnie)" — number input in PLN, converted to grosze on submit.
- "Termin dopłaty" — datetime-local input, converted to unix ms on submit.

Both optional. If left blank, the event is single-payment.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validators/event.ts src/app/dashboard/events
git commit -m "feat(events): deposit + balance_due_at form fields"
```

### Task C2: Show deposit mode on the public event page

**Files:**
- Modify: `src/app/sites/[subdomain]/[eventSlug]/page.tsx`

- [ ] **Step 1: Update the price display**

If `event.depositCents != null && event.depositCents > 0 && event.depositCents < event.priceCents`:
- Show: "Zaliczka: {deposit_zl} zł (dopłata {remaining_zl} zł do {balance_due_at})"
- Otherwise: show `event.priceCents / 100 zł` as before.

- [ ] **Step 2: Commit**

```bash
git add src/app/sites
git commit -m "feat(event-page): show deposit + balance copy when applicable"
```

*(No deposit-branch work on `processRegistration` is needed here — Task A8 already implemented it.)*

---

## Phase D — Magic-link authentication and `/my-trips` pages

### Task D1: HMAC token primitives + tests

**Files:**
- Create: `src/lib/participant-auth.ts`
- Create: `src/lib/participant-auth.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  signParticipantToken,
  verifyParticipantToken,
  signMagicLinkCookie,
  verifyMagicLinkCookie,
  signMagicLinkOneTime,
  verifyMagicLinkOneTime,
} from "./participant-auth";

const SECRET = "test-secret-please-rotate";

describe("participant token", () => {
  it("signs and verifies round-trip", async () => {
    const t = await signParticipantToken("p_abc", SECRET);
    expect(await verifyParticipantToken(t, "p_abc", SECRET)).toBe(true);
  });

  it("rejects tampered payload", async () => {
    const t = await signParticipantToken("p_abc", SECRET);
    expect(await verifyParticipantToken(t, "p_xyz", SECRET)).toBe(false);
  });

  it("rejects wrong secret", async () => {
    const t = await signParticipantToken("p_abc", SECRET);
    expect(await verifyParticipantToken(t, "p_abc", "other")).toBe(false);
  });
});

describe("magic-link cookie", () => {
  it("signs and verifies email session", async () => {
    const c = await signMagicLinkCookie("user@example.com", 1000, SECRET);
    const v = await verifyMagicLinkCookie(c, SECRET, 1000 + 1);
    expect(v).toEqual({ email: "user@example.com", issuedAt: 1000 });
  });

  it("rejects cookie past 30-day TTL", async () => {
    const c = await signMagicLinkCookie("u@e.com", 0, SECRET);
    const v = await verifyMagicLinkCookie(c, SECRET, 0 + 31 * 86_400_000);
    expect(v).toBeNull();
  });

  it("rejects tampered cookie", async () => {
    const c = await signMagicLinkCookie("u@e.com", 0, SECRET);
    const tampered = c.replace(/.$/, (ch) => (ch === "a" ? "b" : "a"));
    expect(await verifyMagicLinkCookie(tampered, SECRET, 1)).toBeNull();
  });
});

describe("magic-link one-time token", () => {
  it("signs and verifies within TTL", async () => {
    const t = await signMagicLinkOneTime("u@e.com", 1000, SECRET);
    const v = await verifyMagicLinkOneTime(t, SECRET, 1000 + 1000);
    expect(v).toEqual({ email: "u@e.com", issuedAt: 1000 });
  });

  it("rejects past 15-min TTL", async () => {
    const t = await signMagicLinkOneTime("u@e.com", 0, SECRET);
    const v = await verifyMagicLinkOneTime(t, SECRET, 16 * 60_000);
    expect(v).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to fail**

Run: `npm test -- participant-auth`
Expected: file-not-found.

- [ ] **Step 3: Implement the module**

Create `src/lib/participant-auth.ts`:

```ts
// Web-crypto HMAC-SHA256 utilities for participant-facing tokens and cookies.
// No DB lookup required; secret rotation is the only invalidation mechanism.

const COOKIE_TTL_MS = 30 * 86_400_000; // 30 days
const ONE_TIME_TTL_MS = 15 * 60_000;   // 15 minutes

const enc = new TextEncoder();
const dec = new TextDecoder();

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

function base64UrlToString(s: string): string {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ── Per-participant token (long-lived, no expiry) ──────────────────────────

export async function signParticipantToken(participantId: string, secret: string): Promise<string> {
  const payload = `pt:${participantId}`;
  const sig = await hmac(secret, payload);
  return sig;
}

export async function verifyParticipantToken(token: string, participantId: string, secret: string): Promise<boolean> {
  const expected = await signParticipantToken(participantId, secret);
  return constantTimeEq(token, expected);
}

// ── Email-scoped magic-link cookie (30-day TTL) ────────────────────────────

function encodeCookieBody(email: string, issuedAt: number): string {
  return bytesToBase64Url(enc.encode(JSON.stringify({ e: email, t: issuedAt })));
}
function decodeCookieBody(s: string): { email: string; issuedAt: number } | null {
  try {
    const obj = JSON.parse(base64UrlToString(s));
    if (typeof obj?.e === "string" && typeof obj?.t === "number") {
      return { email: obj.e, issuedAt: obj.t };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signMagicLinkCookie(email: string, issuedAt: number, secret: string): Promise<string> {
  const body = encodeCookieBody(email, issuedAt);
  const sig = await hmac(secret, `cookie:${body}`);
  return `${body}.${sig}`;
}

export async function verifyMagicLinkCookie(
  cookie: string,
  secret: string,
  nowMs: number,
): Promise<{ email: string; issuedAt: number } | null> {
  const [body, sig] = cookie.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(secret, `cookie:${body}`);
  if (!constantTimeEq(sig, expected)) return null;
  const decoded = decodeCookieBody(body);
  if (!decoded) return null;
  if (decoded.issuedAt + COOKIE_TTL_MS < nowMs) return null;
  return decoded;
}

// ── Short-lived one-time token for request-link flow ───────────────────────

export async function signMagicLinkOneTime(email: string, issuedAt: number, secret: string): Promise<string> {
  const body = encodeCookieBody(email, issuedAt);
  const sig = await hmac(secret, `ot:${body}`);
  return `${body}.${sig}`;
}

export async function verifyMagicLinkOneTime(
  token: string,
  secret: string,
  nowMs: number,
): Promise<{ email: string; issuedAt: number } | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(secret, `ot:${body}`);
  if (!constantTimeEq(sig, expected)) return null;
  const decoded = decodeCookieBody(body);
  if (!decoded) return null;
  if (decoded.issuedAt + ONE_TIME_TTL_MS < nowMs) return null;
  return decoded;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- participant-auth`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/participant-auth.ts src/lib/participant-auth.test.ts
git commit -m "feat(participants): HMAC auth primitives for magic-link + tokens"
```

### Task D2: Wire the shared secret

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `.dev.vars` (local, gitignored)

- [ ] **Step 1: Add secret binding**

Add `PARTICIPANT_AUTH_SECRET` as a secret (not a var — it's sensitive). Local: `echo PARTICIPANT_AUTH_SECRET=$(openssl rand -hex 32) >> .dev.vars`. Remote: `wrangler secret put PARTICIPANT_AUTH_SECRET`.

Update `src/lib/participant-auth.ts` with a helper:

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";
export function getParticipantAuthSecret(): string {
  const { env } = getCloudflareContext();
  const s = (env as unknown as { PARTICIPANT_AUTH_SECRET?: string }).PARTICIPANT_AUTH_SECRET;
  if (!s) throw new Error("PARTICIPANT_AUTH_SECRET not set");
  return s;
}
```

Regenerate types: `npm run cf-typegen`.

- [ ] **Step 2: Commit (no secret value committed)**

```bash
git add wrangler.jsonc cloudflare-env.d.ts src/lib/participant-auth.ts
git commit -m "feat(env): PARTICIPANT_AUTH_SECRET binding"
```

### Task D3: Request-link flow

**Files:**
- Create: `src/app/my-trips/page.tsx`
- Create: `src/app/my-trips/request-link/page.tsx`
- Create: `src/app/my-trips/signin/route.ts`
- Modify: `src/lib/email/send.ts` + templates

- [ ] **Step 1: Add the `my-trips` routes to the middleware allow-list**

Check `src/middleware.ts` — `/my-trips/*` lives on apex (`wyjazdo.pl/my-trips`), not on subdomains. Ensure the middleware doesn't rewrite these. If `my-trips` is not in the reserved/apex-path set, add a check that skips subdomain rewriting when the path starts with `/my-trips`.

- [ ] **Step 2: Request-link form page**

Create `src/app/my-trips/request-link/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { signMagicLinkOneTime, getParticipantAuthSecret } from "@/lib/participant-auth";
import { sendMagicLinkEmail } from "@/lib/email/send";

export default function RequestLinkPage({ searchParams }: { searchParams: { sent?: string } }) {
  async function submit(form: FormData) {
    "use server";
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!email) return;
    const secret = getParticipantAuthSecret();
    const now = Date.now();
    const token = await signMagicLinkOneTime(email, now, secret);
    const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
    const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
    const link = `${proto}//${host}/my-trips/signin?token=${encodeURIComponent(token)}`;
    await sendMagicLinkEmail({ to: email, link });
    redirect("/my-trips/request-link?sent=1");
  }

  return (
    <div className="max-w-md mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Twoje wyjazdy</h1>
      {searchParams.sent ? (
        <p>Wysłaliśmy link logowania. Sprawdź skrzynkę.</p>
      ) : (
        <form action={submit} className="space-y-3">
          <input name="email" type="email" required placeholder="twoj@email.pl" className="input w-full" />
          <button type="submit" className="btn btn-primary w-full">Wyślij link</button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Sign-in consumption route**

Create `src/app/my-trips/signin/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkOneTime, signMagicLinkCookie, getParticipantAuthSecret } from "@/lib/participant-auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new NextResponse("Missing token", { status: 400 });
  const secret = getParticipantAuthSecret();
  const now = Date.now();
  const parsed = await verifyMagicLinkOneTime(token, secret, now);
  if (!parsed) {
    return NextResponse.redirect(new URL("/my-trips/request-link?invalid=1", req.url));
  }
  const cookie = await signMagicLinkCookie(parsed.email, now, secret);
  const res = NextResponse.redirect(new URL("/my-trips", req.url));
  res.cookies.set("wyjazdo_participant_email", cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 86_400,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 4: Email template**

In `src/lib/email/send.ts`:

```ts
export async function sendMagicLinkEmail(params: { to: string; link: string }): Promise<void> {
  await safeSend({
    to: params.to,
    subject: "Twój link do wyjazdo.pl",
    html: `<p>Kliknij, aby zobaczyć swoje wyjazdy:</p><p><a href="${params.link}">Otwórz wyjazdo.pl</a></p><p>Link wygaśnie za 15 minut.</p>`,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/my-trips src/lib/email/send.ts src/middleware.ts
git commit -m "feat(my-trips): request-link flow and session cookie"
```

### Task D4: `/my-trips/[id]` per-participant page

**Files:**
- Create: `src/app/my-trips/[id]/page.tsx`
- Create: `src/lib/db/queries/trip-view.ts`

- [ ] **Step 1: Add a query that loads full trip context**

Create `src/lib/db/queries/trip-view.ts`:

```ts
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { listPaymentsForParticipant } from "@/lib/db/queries/payments";

export async function getTripView(participantId: string) {
  const db = getDb();
  const ctx = await db
    .select({
      participant: schema.participants,
      event: schema.events,
      organizer: schema.organizers,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(eq(schema.participants.id, participantId))
    .limit(1);
  const row = ctx[0];
  if (!row) return null;
  const payments = await listPaymentsForParticipant(participantId);
  return { ...row, payments };
}
```

- [ ] **Step 2: Build the page**

```tsx
// src/app/my-trips/[id]/page.tsx
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTripView } from "@/lib/db/queries/trip-view";
import {
  verifyParticipantToken,
  verifyMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";
import { derivedStatus } from "@/lib/participant-status";
import { payBalanceAction } from "@/app/my-trips/[id]/actions";

export default async function TripPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  const secret = getParticipantAuthSecret();
  const now = Date.now();

  const trip = await getTripView(params.id);
  if (!trip) notFound();

  const tokenOk = searchParams.t
    ? await verifyParticipantToken(searchParams.t, params.id, secret)
    : false;

  let cookieOk = false;
  if (!tokenOk) {
    const c = (await cookies()).get("wyjazdo_participant_email")?.value;
    if (c) {
      const session = await verifyMagicLinkCookie(c, secret, now);
      if (session?.email.toLowerCase() === trip.participant.email.toLowerCase()) cookieOk = true;
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
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">{trip.event.title}</h1>
      <p>{trip.organizer.displayName}</p>
      <p>{new Date(trip.event.startsAt).toLocaleString("pl-PL")}</p>

      <section className="p-4 border rounded space-y-2">
        <h2 className="font-semibold">Płatność</h2>
        {full && <p>Opłacone: {(full.amountCents / 100).toFixed(2)} zł</p>}
        {deposit && (
          <p>
            Zaliczka: {(deposit.amountCents / 100).toFixed(2)} zł —{" "}
            {deposit.status === "succeeded" ? "opłacona" : "oczekuje"}
          </p>
        )}
        {balance && (
          <p>
            Dopłata: {(balance.amountCents / 100).toFixed(2)} zł —{" "}
            {balance.status === "succeeded" ? "opłacona" : "oczekuje"}
          </p>
        )}
        {balanceDue && <p>Termin dopłaty: {new Date(balanceDue).toLocaleDateString("pl-PL")}</p>}

        {showPayBalance && (
          <form action={payBalanceAction}>
            <input type="hidden" name="participantId" value={trip.participant.id} />
            <input type="hidden" name="token" value={searchParams.t ?? ""} />
            <button type="submit" className="btn btn-primary">Opłać dopłatę</button>
          </form>
        )}
      </section>

      {trip.organizer.contactEmail && (
        <p>
          Pytanie? <a href={`mailto:${trip.organizer.contactEmail}`}>Skontaktuj się z organizatorem</a>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/my-trips src/lib/db/queries/trip-view.ts
git commit -m "feat(my-trips): per-participant trip page with token or cookie auth"
```

### Task D5: `/my-trips` index page

**Files:**
- Modify: `src/app/my-trips/page.tsx`

- [ ] **Step 1: List all trips for the cookie session email**

```tsx
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listParticipantsByEmail } from "@/lib/db/queries/participants";
import { listPaymentsForParticipants } from "@/lib/db/queries/payments";
import { verifyMagicLinkCookie, getParticipantAuthSecret } from "@/lib/participant-auth";
import { derivedStatus } from "@/lib/participant-status";

export default async function MyTripsIndex() {
  const secret = getParticipantAuthSecret();
  const now = Date.now();
  const c = (await cookies()).get("wyjazdo_participant_email")?.value;
  if (!c) redirect("/my-trips/request-link");
  const session = await verifyMagicLinkCookie(c, secret, now);
  if (!session) redirect("/my-trips/request-link?invalid=1");

  const participants = await listParticipantsByEmail(session.email);
  const paymentsByPid = new Map<string, { kind: "full" | "deposit" | "balance"; status: "pending"|"succeeded"|"expired"|"failed"|"refunded"; dueAt: number | null }[]>();
  const all = await listPaymentsForParticipants(participants.map((p) => p.id));
  for (const pmt of all) {
    const list = paymentsByPid.get(pmt.participantId) ?? [];
    list.push({ kind: pmt.kind, status: pmt.status, dueAt: pmt.dueAt });
    paymentsByPid.set(pmt.participantId, list);
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Twoje wyjazdy</h1>
      {participants.length === 0 && <p>Brak rejestracji.</p>}
      <ul className="space-y-3">
        {participants.map((p) => {
          const status = derivedStatus(
            { lifecycleStatus: p.lifecycleStatus },
            paymentsByPid.get(p.id) ?? [],
            now,
          );
          return (
            <li key={p.id} className="border rounded p-4">
              <Link href={`/my-trips/${p.id}`}>Wyjazd #{p.id.slice(-6)}</Link>
              <p className="text-sm">{status}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

The link list shows event title too — extend the query to pull event/organizer names (adjust `listParticipantsByEmail` or add a new joined query). For minimum plan size: add a new query `listTripSummariesByEmail` that returns participant + event title + organizer name:

```ts
// src/lib/db/queries/participants.ts (append)
export async function listTripSummariesByEmail(email: string) {
  const db = getDb();
  return db
    .select({
      participantId: schema.participants.id,
      lifecycleStatus: schema.participants.lifecycleStatus,
      eventTitle: schema.events.title,
      organizerName: schema.organizers.displayName,
      startsAt: schema.events.startsAt,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(eq(schema.participants.email, email))
    .all();
}
```

Use it instead. Render event title and organizer name for each row.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(my-trips): index page listing trips for cookie session"
```

### Task D6: "Pay balance" server action

**Files:**
- Create: `src/app/my-trips/[id]/actions.ts`
- Create: `src/lib/register/ensure-balance-payment.ts`

- [ ] **Step 1: Extract a balance-payment helper**

```ts
// src/lib/register/ensure-balance-payment.ts
import { getStripe } from "@/lib/stripe";
import { newId } from "@/lib/ids";
import {
  insertPayment,
  setPaymentStripeSession,
  listPaymentsForParticipant,
} from "@/lib/db/queries/payments";
import type { Participant, Event, Organizer } from "@/lib/db/schema";

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/** Ensures a pending 'balance' payment row and an active Stripe Checkout Session. Returns the Session URL. */
export async function ensureBalancePayment(params: {
  participant: Participant;
  event: Event;
  organizer: Organizer;
  origin: string;
}): Promise<string> {
  const { participant, event, organizer, origin } = params;
  if (!organizer.stripeAccountId) throw new Error("organizer not connected");
  if (event.depositCents == null || event.depositCents === 0 || event.depositCents >= event.priceCents) {
    throw new Error("event is not deposit-mode");
  }

  const existing = await listPaymentsForParticipant(participant.id);
  const existingBalance = existing.find((p) => p.kind === "balance");
  const now = Date.now();
  const balanceAmount = event.priceCents - event.depositCents;

  let paymentId: string;
  if (existingBalance && existingBalance.status === "pending" && existingBalance.stripeSessionId) {
    // Re-use the existing pending payment and Session if not expired — otherwise replace.
    const stripe = getStripe();
    try {
      const s = await stripe.checkout.sessions.retrieve(existingBalance.stripeSessionId, {
        stripeAccount: organizer.stripeAccountId,
      });
      if (s.status === "open" && s.url) return s.url;
    } catch {
      // fall through to create new
    }
    paymentId = existingBalance.id;
  } else if (existingBalance && existingBalance.status !== "succeeded") {
    paymentId = newId();
    await insertPayment({
      id: paymentId,
      participantId: participant.id,
      kind: "balance",
      amountCents: balanceAmount,
      currency: "PLN",
      status: "pending",
      dueAt: event.balanceDueAt ?? null,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      stripeApplicationFee: null,
      lastReminderAt: null,
      paidAt: null,
      expiresAt: now + PENDING_TTL_MS,
      createdAt: now,
      updatedAt: now,
    });
  } else if (!existingBalance) {
    paymentId = newId();
    await insertPayment({
      id: paymentId,
      participantId: participant.id,
      kind: "balance",
      amountCents: balanceAmount,
      currency: "PLN",
      status: "pending",
      dueAt: event.balanceDueAt ?? null,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      stripeApplicationFee: null,
      lastReminderAt: null,
      paidAt: null,
      expiresAt: now + PENDING_TTL_MS,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    throw new Error("balance already succeeded");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: participant.email,
      line_items: [
        {
          price_data: {
            currency: "pln",
            unit_amount: balanceAmount,
            product_data: { name: `Dopłata — ${event.title}` },
          },
          quantity: 1,
        },
      ],
      metadata: { payment_id: paymentId, participant_id: participant.id },
      payment_intent_data: {
        application_fee_amount: 0,
        metadata: { payment_id: paymentId, participant_id: participant.id },
      },
      success_url: `${origin}/my-trips/${participant.id}`,
      cancel_url: `${origin}/my-trips/${participant.id}`,
      expires_at: Math.floor((now + PENDING_TTL_MS) / 1000),
    },
    { stripeAccount: organizer.stripeAccountId },
  );
  await setPaymentStripeSession(paymentId, session.id);
  if (!session.url) throw new Error("no session url");
  return session.url;
}
```

- [ ] **Step 2: Create the server action**

```ts
// src/app/my-trips/[id]/actions.ts
"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ensureBalancePayment } from "@/lib/register/ensure-balance-payment";
import { getTripView } from "@/lib/db/queries/trip-view";
import {
  verifyParticipantToken,
  verifyMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";

export async function payBalanceAction(form: FormData): Promise<void> {
  const participantId = String(form.get("participantId") ?? "");
  const token = String(form.get("token") ?? "");

  const secret = getParticipantAuthSecret();
  const now = Date.now();

  const trip = await getTripView(participantId);
  if (!trip) throw new Error("not found");

  let ok = false;
  if (token) ok = await verifyParticipantToken(token, participantId, secret);
  if (!ok) {
    const c = (await cookies()).get("wyjazdo_participant_email")?.value;
    if (c) {
      const session = await verifyMagicLinkCookie(c, secret, now);
      if (session?.email.toLowerCase() === trip.participant.email.toLowerCase()) ok = true;
    }
  }
  if (!ok) throw new Error("unauthorized");

  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const url = await ensureBalancePayment({
    participant: trip.participant,
    event: trip.event,
    organizer: trip.organizer,
    origin: `${proto}//${host}`,
  });
  redirect(url);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/my-trips src/lib/register/ensure-balance-payment.ts
git commit -m "feat(my-trips): pay-balance server action + ensureBalancePayment"
```

---

## Phase E — Reminder cron

### Task E1: Reminder-window selection logic + tests

**Files:**
- Create: `src/lib/balance-reminders.ts`
- Create: `src/lib/balance-reminders.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { shouldSendReminder } from "./balance-reminders";

const DAY = 86_400_000;

describe("shouldSendReminder", () => {
  it("sends at T-14d window", () => {
    const due = 100 * DAY;
    const now = due - 14 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: null })).toBe(true);
  });
  it("sends at T-3d window", () => {
    const due = 100 * DAY;
    const now = due - 3 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: null })).toBe(true);
  });
  it("sends at T-0 window", () => {
    const due = 100 * DAY;
    const now = due - DAY / 4; // within ±12h
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: null })).toBe(true);
  });
  it("does not re-send when lastReminderAt is today", () => {
    const due = 100 * DAY;
    const now = due - 14 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: now - 60_000 })).toBe(false);
  });
  it("sends when lastReminderAt is yesterday", () => {
    const due = 100 * DAY;
    const now = due - 14 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: now - 25 * 60 * 60_000 })).toBe(true);
  });
  it("does not send outside the windows", () => {
    const due = 100 * DAY;
    const now = due - 10 * DAY;
    expect(shouldSendReminder({ nowMs: now, dueAtMs: due, lastReminderAt: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/lib/balance-reminders.ts
const DAY = 86_400_000;
const HOUR = 3_600_000;

const WINDOWS = [
  { centerMsBeforeDue: 14 * DAY, halfWidthMs: 1 * DAY },
  { centerMsBeforeDue: 3 * DAY, halfWidthMs: 12 * HOUR },
  { centerMsBeforeDue: 0, halfWidthMs: 12 * HOUR },
];

export function shouldSendReminder(params: {
  nowMs: number;
  dueAtMs: number;
  lastReminderAt: number | null;
}): boolean {
  const { nowMs, dueAtMs, lastReminderAt } = params;
  const distance = dueAtMs - nowMs;
  const inWindow = WINDOWS.some(
    (w) => Math.abs(distance - w.centerMsBeforeDue) <= w.halfWidthMs,
  );
  if (!inWindow) return false;
  if (lastReminderAt != null && nowMs - lastReminderAt < 24 * HOUR) return false;
  return true;
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- balance-reminders`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/balance-reminders.ts src/lib/balance-reminders.test.ts
git commit -m "feat(reminders): window-selection logic with tests"
```

### Task E2: Reminder email template + send function

**Files:**
- Modify: `src/lib/email/send.ts`
- Modify: `src/lib/email/templates.ts`

- [ ] **Step 1: Add template**

In `src/lib/email/templates.ts`:

```ts
export function balanceReminderSubject(eventTitle: string) {
  return `Przypomnienie o dopłacie — ${eventTitle}`;
}

export function balanceReminderHtml(params: {
  participantName: string;
  eventTitle: string;
  amountPln: string;
  dueDate: string;
  payUrl: string;
  organizerName: string;
}) {
  return `<p>Cześć ${params.participantName},</p>
  <p>Do opłacenia pozostało ${params.amountPln} zł za <strong>${params.eventTitle}</strong>.</p>
  <p>Termin dopłaty: ${params.dueDate}.</p>
  <p><a href="${params.payUrl}">Opłać teraz</a></p>
  <p>— ${params.organizerName}</p>`;
}
```

In `src/lib/email/send.ts`:

```ts
export async function sendBalanceReminder(params: {
  to: string;
  participantName: string;
  eventTitle: string;
  amountPln: string;
  dueDate: string;
  payUrl: string;
  organizerName: string;
}): Promise<void> {
  await safeSend({
    to: params.to,
    subject: balanceReminderSubject(params.eventTitle),
    html: balanceReminderHtml(params),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email/send.ts src/lib/email/templates.ts
git commit -m "feat(email): balance-reminder template"
```

### Task E3: Cron handler

**Files:**
- Create: `src/app/api/cron/balance-reminders/route.ts`
- Modify: `wrangler.jsonc`
- Modify: `worker.ts` (if cron dispatch happens there)

- [ ] **Step 1: Read `worker.ts`**

Understand how the existing `*/10 * * * *` cron is dispatched. It likely has a `scheduled()` handler that switches on the cron expression.

- [ ] **Step 2: Add the second cron trigger**

In `wrangler.jsonc`:

```json
"triggers": {
  "crons": ["*/10 * * * *", "0 8 * * *"]
}
```

(`0 8 * * *` = 08:00 UTC daily. Europe/Warsaw in summer is UTC+2 = 10:00 locally; in winter 09:00. Close enough for MVP; for exact 08:00 local, schedule two and skip the wrong one based on DST. Note the trade-off in a comment and move on.)

- [ ] **Step 3: Implement the handler**

Create `src/app/api/cron/balance-reminders/route.ts`:

```ts
import { eq, and, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { derivedStatus } from "@/lib/participant-status";
import { shouldSendReminder } from "@/lib/balance-reminders";
import { ensureBalancePayment } from "@/lib/register/ensure-balance-payment";
import { sendBalanceReminder } from "@/lib/email/send";
import {
  listPaymentsForParticipants,
  setPaymentLastReminderAt,
} from "@/lib/db/queries/payments";
import { signParticipantToken, getParticipantAuthSecret } from "@/lib/participant-auth";

export async function GET() {
  const db = getDb();
  const now = Date.now();

  // Pull all active participants for events with deposits configured.
  const rows = await db
    .select({
      participant: schema.participants,
      event: schema.events,
      organizer: schema.organizers,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(and(eq(schema.participants.lifecycleStatus, "active"), isNotNull(schema.events.depositCents)));

  const pids = rows.map((r) => r.participant.id);
  const allPayments = await listPaymentsForParticipants(pids);
  const byPid = new Map<string, typeof allPayments>();
  for (const p of allPayments) {
    const list = byPid.get(p.participantId) ?? [];
    list.push(p);
    byPid.set(p.participantId, list);
  }

  const secret = getParticipantAuthSecret();
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  let sent = 0;
  for (const r of rows) {
    const payments = byPid.get(r.participant.id) ?? [];
    const status = derivedStatus(
      { lifecycleStatus: r.participant.lifecycleStatus },
      payments.map((p) => ({ kind: p.kind, status: p.status, dueAt: p.dueAt })),
      now,
    );
    if (status !== "deposit_paid") continue;
    if (r.event.balanceDueAt == null) continue;

    const balance = payments.find((p) => p.kind === "balance");
    const dueAtMs = balance?.dueAt ?? r.event.balanceDueAt;
    const lastReminderAt = balance?.lastReminderAt ?? null;
    if (!shouldSendReminder({ nowMs: now, dueAtMs, lastReminderAt })) continue;

    try {
      const payUrl = await ensureBalancePayment({
        participant: r.participant,
        event: r.event,
        organizer: r.organizer,
        origin: `${proto}//${host}`,
      });

      // After ensureBalancePayment, the balance payment row exists. Re-read:
      const refreshed = await listPaymentsForParticipants([r.participant.id]);
      const b = refreshed.find((p) => p.kind === "balance");
      if (!b) continue;

      const token = await signParticipantToken(r.participant.id, secret);
      const tripUrl = `${proto}//${host}/my-trips/${r.participant.id}?t=${encodeURIComponent(token)}`;

      await sendBalanceReminder({
        to: r.participant.email,
        participantName: r.participant.firstName,
        eventTitle: r.event.title,
        amountPln: (b.amountCents / 100).toFixed(2),
        dueDate: new Date(dueAtMs).toLocaleDateString("pl-PL"),
        payUrl: tripUrl,
        organizerName: r.organizer.displayName,
      });
      await setPaymentLastReminderAt(b.id, now);
      sent += 1;
    } catch (err) {
      console.error("reminder send failed for", r.participant.id, err);
    }
  }

  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
}
```

- [ ] **Step 4: Wire scheduled dispatch**

In `worker.ts`, extend the `scheduled` handler to route `"0 8 * * *"` to the balance-reminders route. If the existing handler uses direct fetch forwarding, add a branch on `event.cron`. If there is no existing pattern, invoke the route handler's function directly (import `GET` from the route file — but App Router route handlers are harder to import from worker.ts; prefer factoring the body into a library function and calling it from both the route and the scheduled handler).

Concretely: extract the body into `src/lib/cron/balance-reminders.ts` (`export async function runBalanceReminders()`), have the route call it, and also call it from `worker.ts`'s scheduled handler.

- [ ] **Step 5: Manual verification**

1. Create a test event with deposit.
2. Register a participant and pay the deposit.
3. Update the event's `balance_due_at` to now + 14 days.
4. Trigger the cron locally: `curl http://localhost:8787/api/cron/balance-reminders` (or `wrangler dev --test-scheduled`, then `curl http://localhost:8787/__scheduled?cron=0+8+*+*+*`).
5. Verify reminder email received and `payments.last_reminder_at` updated.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/balance-reminders src/lib/cron/balance-reminders.ts worker.ts wrangler.jsonc
git commit -m "feat(cron): nightly balance-reminder dispatcher"
```

---

## Phase F — Dashboard updates (overdue + extend + cancel)

### Task F1: Overdue bucket in event dashboard

**Files:**
- Modify: `src/app/dashboard/events/[id]/page.tsx` (and subpages)
- Modify: `src/lib/db/queries/events-dashboard.ts`

- [ ] **Step 1: Extend the dashboard query to return derived status**

Read `src/lib/db/queries/events-dashboard.ts` first. Update the query that lists participants to also load payments and compute `derivedStatus` for each row. Return `derivedStatus` as a string on each row.

- [ ] **Step 2: Add an "Overdue" tab**

In the event dashboard page, filter the participant table into tabs: All / Paid / Deposit paid / Overdue / Waitlist / Cancelled. The `overdue` tab shows participants whose derived status is `overdue`. Each row has two action buttons (Task F2, F3).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(dashboard): overdue bucket and derived-status tabs"
```

### Task F2: "Extend deadline" action

**Files:**
- Create or modify dashboard actions file

- [ ] **Step 1: Add server action**

```ts
"use server";
import { auth } from "@clerk/nextjs/server";
import {
  getPaymentById,
  setBalanceDueAtForPayment,
} from "@/lib/db/queries/payments";
import { getParticipantById } from "@/lib/db/queries/participants";
import { getEventById } from "@/lib/db/queries/events";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { revalidatePath } from "next/cache";

export async function extendBalanceDeadline(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");

  const paymentId = String(form.get("paymentId") ?? "");
  const newDue = Number(form.get("dueAt") ?? 0);
  if (!paymentId || !newDue) throw new Error("missing fields");

  const payment = await getPaymentById(paymentId);
  if (!payment || payment.kind !== "balance") throw new Error("invalid payment");
  const participant = await getParticipantById(payment.participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");

  await setBalanceDueAtForPayment(paymentId, newDue);
  revalidatePath(`/dashboard/events/${event.id}`);
}
```

- [ ] **Step 2: Add a date-picker inline UI in the overdue row**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(dashboard): extend balance deadline action"
```

### Task F3: "Cancel & free spot" action

**Files:**
- Create or modify dashboard actions file

- [ ] **Step 1: Add server action**

```ts
"use server";
import { auth } from "@clerk/nextjs/server";
import { cancelParticipant, getParticipantById } from "@/lib/db/queries/participants";
import { getEventById } from "@/lib/db/queries/events";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { revalidatePath } from "next/cache";

export async function cancelAndFreeSpot(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");

  const participantId = String(form.get("participantId") ?? "");
  const participant = await getParticipantById(participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");

  await cancelParticipant(participantId);
  revalidatePath(`/dashboard/events/${event.id}`);
}
```

- [ ] **Step 2: Add button + confirmation in the overdue row**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(dashboard): cancel-and-free-spot action"
```

---

## Phase G — Finance tab (Connect balance + payouts)

### Task G1: Fetch Connect balance + payouts list

**Files:**
- Modify: `src/app/dashboard/finance/page.tsx`
- Modify: `src/lib/db/queries/finance.ts` (existing)
- Create: `src/lib/stripe-finance.ts`

- [ ] **Step 1: Implement Stripe helpers**

```ts
// src/lib/stripe-finance.ts
import { getStripe } from "@/lib/stripe";

export async function fetchConnectBalance(accountId: string) {
  const stripe = getStripe();
  return stripe.balance.retrieve({ stripeAccount: accountId });
}

export async function fetchRecentPayouts(accountId: string, limit = 10) {
  const stripe = getStripe();
  const res = await stripe.payouts.list({ limit }, { stripeAccount: accountId });
  return res.data;
}

export async function createManualPayout(accountId: string, amountMinorUnits: number, currency: string) {
  const stripe = getStripe();
  return stripe.payouts.create({ amount: amountMinorUnits, currency }, { stripeAccount: accountId });
}

export async function createExpressLoginLink(accountId: string) {
  const stripe = getStripe();
  return stripe.accounts.createLoginLink(accountId);
}
```

- [ ] **Step 2: Update Finance page**

Render organizer's Connect account balance (available + pending), a button "Wypłać teraz" invoking a server action that calls `createManualPayout`, a list of recent payouts, and a link to the Express Dashboard (via `createExpressLoginLink`). Handle the case where organizer has not yet completed onboarding — show banner directing them back to onboarding.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(finance): Connect balance + manual payout button + Express link"
```

---

## Phase H — Final verification and polish

### Task H1: End-to-end manual test

- [ ] **Step 1: Run the full loop in Stripe test mode**

1. Register as a new organizer — complete Express onboarding.
2. Create a deposit-mode event (price 600 zł, deposit 200 zł, balance due 30 days from now).
3. Register as participant A. Pay the deposit with test card. Confirm:
   - `payments` rows: `deposit` succeeded.
   - derived status: `deposit_paid`.
   - confirmation email received.
4. Force the reminder cron locally with `dueAt` moved to `now + 14d`. Confirm reminder email with per-trip link.
5. Click the link → lands on `/my-trips/<id>`. Click "Opłać dopłatę" → Stripe Checkout.
6. Pay → return. Confirm `payments.balance.status=succeeded` → derived status `paid` → confirmation email.
7. Organizer dashboard: participant shows under Paid.
8. Finance tab: Connect balance shows the amounts; trigger a manual payout.
9. Refund one payment from Stripe Express Dashboard. Confirm `charge.refunded` webhook hits Connect endpoint → `payments` row marked `refunded` → dashboard reflects it.

- [ ] **Step 2: Edge cases**

- Missing Stripe onboarding: "Publish" button disabled, banner showing.
- Overdue case: move `balance_due_at` to the past for one participant; organizer sees them in Overdue tab; extend deadline; confirm they leave the bucket; cancel-and-free-spot; confirm spot returns in capacity count.
- Magic-link tamper: modify `?t=...`; lands on 404 as expected.
- Request-link email flow: request link, click, see all trips across organizers.

### Task H2: Commit, tag, push for deploy

- [ ] **Step 1: Final commit if anything left**

```bash
git status
```

- [ ] **Step 2: Tag**

```bash
git tag v0.2.0-connect-deposits
```

- [ ] **Step 3: Deploy to preview**

Follow existing deploy pattern (`npm run deploy`). Set secrets in production: `STRIPE_CONNECT_WEBHOOK_SECRET`, `PARTICIPANT_AUTH_SECRET`. Add the Connect webhook URL and the participant-auth secret in the production Stripe dashboard.

---

## Cross-phase checklist

- [ ] All tests green: `npm test`
- [ ] Type-check green: `npx tsc --noEmit`
- [ ] Lint green: `npm run lint`
- [ ] Local migration applied: `npm run db:migrate:local`
- [ ] Remote migration applied pre-deploy: `npm run db:migrate:remote`
- [ ] All three Stripe secrets set in prod: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`
- [ ] Participant auth secret set: `PARTICIPANT_AUTH_SECRET`
- [ ] Two webhook endpoints configured in Stripe: platform (`/api/stripe/webhook`) and connect (`/api/stripe/connect-webhook`)
- [ ] Middleware allows `/my-trips/*` on apex
- [ ] Connect enabled in Stripe account

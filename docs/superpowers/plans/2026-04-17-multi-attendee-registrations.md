# Multi-Attendee Registrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one registrant sign up multiple attendees (parent+children, groups, etc.) with per-type pricing, graduated discounts, and per-attendee custom fields — all exposed via preset-driven UX that stays simple for non-technical organizers.

**Architecture:** One underlying primitive — `attendeeTypes` (JSON array on `events`) — drives everything. A new `attendees` table stores per-person data belonging to a `participants` row (now the "registrant/payer"). Presets on the organizer side pre-fill the same data structure. Pricing is a pure function used by both client preview and server authoritative calculation. Capacity counts active attendee rows. Legacy events without `attendeeTypes` continue to work via an implicit-single-type fallback.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + Cloudflare D1, Stripe Connect, Clerk auth, Zod, Vitest, TailwindCSS. Existing patterns: JSON columns with Zod validators (see `customQuestions`), Server Actions for form submission, `process-registration.ts` orchestrator.

**Spec:** [docs/superpowers/specs/2026-04-17-multi-attendee-registrations-design.md](../specs/2026-04-17-multi-attendee-registrations-design.md)

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/lib/db/migrations/0004_multi_attendee.sql` | Schema migration — adds `attendees` table and `attendee_types` column on events. |
| `src/lib/validators/attendee-types.ts` | Zod schemas for `AttendeeType`, `AttendeeTypeCustomField`, `GraduatedPricingTier`. Exported types. |
| `src/lib/pricing.ts` | Pure pricing engine. `calculateTotal(types, quantities)` used by server and client. |
| `src/lib/pricing.test.ts` | Unit tests for pricing. |
| `src/lib/attendee-presets.ts` | Preset definitions (`jedna_osoba`, `rodzic_z_dziecmi`, `grupa`). `buildPresetTypes(presetId, event)` returns the pre-filled `AttendeeType[]`. |
| `src/lib/attendee-presets.test.ts` | Unit tests for preset expansion. |
| `src/lib/db/queries/attendees.ts` | CRUD: `insertAttendees`, `listActiveAttendeesForParticipant`, `listAttendeesForEvent`, `softCancelAttendee`. |
| `src/lib/validators/attendees-form.ts` | Zod schema for per-attendee form input `{ attendeeTypeId, firstName, lastName, customAnswers }`. |
| `src/app/dashboard/events/[id]/attendee-types-field.tsx` | Client component — the "Kto bierze udział?" section. Renders preset cards, conditionally the editor. Also used by `new/page.tsx`. |
| `src/app/dashboard/events/[id]/AttendeeTypesEditor.tsx` | Advanced editor (add/remove types, set qty/price/graduated pricing/custom fields). |
| `src/app/sites/[subdomain]/[eventSlug]/register/AttendeeCard.tsx` | Single attendee form card (firstName, lastName, custom fields for its type). |
| `src/app/sites/[subdomain]/[eventSlug]/register/price-summary.tsx` | Live-updating price breakdown. |
| `src/app/dashboard/events/[id]/participants/AttendeeGroupRow.tsx` | Expandable group row showing registrant + attendees with per-attendee remove button. |
| `src/app/dashboard/events/[id]/participants/RemoveAttendeeDialog.tsx` | Confirmation dialog with suggested refund when removing a single attendee. |

### Modified files

| Path | Change |
|---|---|
| `src/lib/db/schema.ts` | Add `attendeeTypes` column on `events`; add `attendees` table + exported types. |
| `src/lib/validators/event.ts` | Add optional `attendeeTypes` field on `eventBaseSchema`. Keep `priceCents` for backward compat. |
| `src/lib/validators/registration.ts` | Extend with attendees array + per-attendee custom answers. |
| `src/lib/capacity.ts` | Count active attendee rows per qualifying participant instead of `1 per participant`. |
| `src/lib/capacity.test.ts` | Extend tests for attendee counting. |
| `src/lib/register/process-registration.ts` | Read `attendeeTypes`, parse attendees from form, recalculate total server-side, insert `attendees` rows, use calculated total for Stripe. |
| `src/lib/db/queries/events.ts` | Include `attendeeTypes` in selects. |
| `src/lib/db/queries/participants.ts` | Add helpers returning participants with their active attendee rows. |
| `src/app/dashboard/events/[id]/EventEditForm.tsx` | Replace single "Cena" field (where applicable) with the `attendee-types-field` component. |
| `src/app/dashboard/events/new/page.tsx` | Same integration. |
| `src/app/dashboard/events/[id]/actions.ts` | Accept & persist `attendeeTypes`. Updated cancellation action (suggests refund, lists affected attendees). |
| `src/app/sites/[subdomain]/[eventSlug]/register/RegisterForm.tsx` | Replace single registrant form with registrant + attendee cards + price summary. |
| `src/app/sites/[subdomain]/[eventSlug]/register/actions.ts` | Pass through the form to the updated `processRegistration`. |
| `src/app/dashboard/events/[id]/page.tsx` (or participant list component) | Render `AttendeeGroupRow` per registration. |

---

## Phase 0 — Schema & data layer

### Task 0.1: Add `attendeeTypes` JSON column on events

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/migrations/0004_multi_attendee.sql`

- [ ] **Step 1: Add column to Drizzle schema**

In `src/lib/db/schema.ts`, locate the `events` table definition (around line 31). Add `attendeeTypes` after `customQuestions`:

```ts
    customQuestions: text("custom_questions"),
    attendeeTypes: text("attendee_types"),
    depositCents: integer("deposit_cents"),
```

- [ ] **Step 2: Create the migration file**

Create `src/lib/db/migrations/0004_multi_attendee.sql` with:

```sql
-- 0004_multi_attendee.sql
-- Adds: events.attendee_types (JSON) and the attendees table for multi-attendee registrations.

ALTER TABLE `events` ADD COLUMN `attendee_types` text;
--> statement-breakpoint

CREATE TABLE `attendees` (
  `id` text PRIMARY KEY NOT NULL,
  `participant_id` text NOT NULL,
  `attendee_type_id` text NOT NULL,
  `first_name` text NOT NULL,
  `last_name` text NOT NULL,
  `custom_answers` text,
  `cancelled_at` integer,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attendees_participant_idx` ON `attendees` (`participant_id`);
--> statement-breakpoint
CREATE INDEX `attendees_participant_active_idx` ON `attendees` (`participant_id`, `cancelled_at`);
```

- [ ] **Step 3: Add `attendees` table to schema**

In `src/lib/db/schema.ts`, after the `participants` table (around line 97), add:

```ts
export const attendees = sqliteTable(
  "attendees",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    attendeeTypeId: text("attendee_type_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    customAnswers: text("custom_answers"),
    cancelledAt: integer("cancelled_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    participantIdx: index("attendees_participant_idx").on(t.participantId),
    participantActiveIdx: index("attendees_participant_active_idx").on(t.participantId, t.cancelledAt),
  }),
);

export type Attendee = typeof attendees.$inferSelect;
export type NewAttendee = typeof attendees.$inferInsert;
```

- [ ] **Step 4: Verify schema compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/0004_multi_attendee.sql
git commit -m "feat(db): add attendees table and event.attendee_types column"
```

---

### Task 0.2: Validators for attendee types

**Files:**
- Create: `src/lib/validators/attendee-types.ts`
- Modify: `src/lib/validators/event.ts`

- [ ] **Step 1: Create the validator module**

Create `src/lib/validators/attendee-types.ts`:

```ts
import { z } from "zod";

export const attendeeCustomFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  type: z.enum(["text", "long_text", "select", "number", "date"]),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
});
export type AttendeeCustomField = z.infer<typeof attendeeCustomFieldSchema>;

export const graduatedPricingTierSchema = z.object({
  fromQty: z.number().int().min(2),
  priceCents: z.number().int().nonnegative(),
});
export type GraduatedPricingTier = z.infer<typeof graduatedPricingTierSchema>;

export const attendeeTypeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    minQty: z.number().int().min(0).max(50),
    maxQty: z.number().int().min(1).max(50),
    priceCents: z.number().int().nonnegative(),
    graduatedPricing: z.array(graduatedPricingTierSchema).max(10).optional(),
    customFields: z.array(attendeeCustomFieldSchema).max(20).optional(),
  })
  .refine((t) => t.maxQty >= t.minQty, {
    message: "Maksymalna ilość musi być większa lub równa minimalnej.",
    path: ["maxQty"],
  });
export type AttendeeType = z.infer<typeof attendeeTypeSchema>;

export const attendeeTypesSchema = z.array(attendeeTypeSchema).min(1).max(10);
```

- [ ] **Step 2: Wire `attendeeTypes` into the event schema**

In `src/lib/validators/event.ts`, import the new schema and add the optional field in `eventBaseSchema`:

At the top, add:
```ts
import { attendeeTypesSchema } from "./attendee-types";
```

Inside `eventBaseSchema`'s `.object({ ... })` (after `customQuestions`):
```ts
    attendeeTypes: attendeeTypesSchema.nullable().optional(),
```

Add a final `.refine` at the end of the chain (after the last `.refine`):
```ts
  .refine(
    (d) =>
      d.attendeeTypes == null ||
      d.attendeeTypes.every((t) => t.minQty <= t.maxQty),
    { message: "Niepoprawna konfiguracja typów uczestników.", path: ["attendeeTypes"] },
  )
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validators/attendee-types.ts src/lib/validators/event.ts
git commit -m "feat(validators): add attendeeTypes schema"
```

---

## Phase 1 — Pricing engine

### Task 1.1: `calculateTotal` pure function (TDD)

**Files:**
- Create: `src/lib/pricing.ts`
- Test: `src/lib/pricing.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateTotal } from "./pricing";
import type { AttendeeType } from "./validators/attendee-types";

const parent: AttendeeType = {
  id: "rodzic",
  name: "Rodzic",
  minQty: 1,
  maxQty: 1,
  priceCents: 20000,
};

const child: AttendeeType = {
  id: "dziecko",
  name: "Dziecko",
  minQty: 1,
  maxQty: 5,
  priceCents: 10000,
  graduatedPricing: [{ fromQty: 2, priceCents: 8000 }],
};

describe("calculateTotal", () => {
  it("returns 0 when no attendees", () => {
    expect(calculateTotal([parent, child], {}).total).toBe(0);
  });

  it("applies base price when no graduated tier matches", () => {
    const r = calculateTotal([parent, child], { rodzic: 1, dziecko: 1 });
    expect(r.total).toBe(30000); // 200 + 100
    expect(r.perType).toEqual([
      { typeId: "rodzic", subtotal: 20000, breakdown: [{ position: 1, priceCents: 20000 }] },
      { typeId: "dziecko", subtotal: 10000, breakdown: [{ position: 1, priceCents: 10000 }] },
    ]);
  });

  it("applies graduated tier from the nth attendee onwards", () => {
    // 1 parent + 3 children: 200 + 100 + 80 + 80 = 460
    const r = calculateTotal([parent, child], { rodzic: 1, dziecko: 3 });
    expect(r.total).toBe(46000);
  });

  it("picks the highest matching tier when multiple tiers exist", () => {
    const t: AttendeeType = {
      id: "t",
      name: "T",
      minQty: 1,
      maxQty: 10,
      priceCents: 10000,
      graduatedPricing: [
        { fromQty: 2, priceCents: 8000 },
        { fromQty: 4, priceCents: 6000 },
      ],
    };
    // positions 1..5 → 100, 80, 80, 60, 60 = 380
    expect(calculateTotal([t], { t: 5 }).total).toBe(38000);
  });

  it("ignores types not referenced in quantities", () => {
    expect(calculateTotal([parent, child], { rodzic: 1 }).total).toBe(20000);
  });

  it("ignores unknown typeIds in quantities", () => {
    expect(calculateTotal([parent], { rodzic: 1, zombie: 3 }).total).toBe(20000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/pricing.test.ts`
Expected: FAIL with "Cannot find module './pricing'" or similar.

- [ ] **Step 3: Implement `calculateTotal`**

Create `src/lib/pricing.ts`:

```ts
import type { AttendeeType } from "./validators/attendee-types";

export type PriceBreakdownItem = { position: number; priceCents: number };
export type PerTypeSubtotal = {
  typeId: string;
  subtotal: number;
  breakdown: PriceBreakdownItem[];
};
export type PriceCalculation = {
  perType: PerTypeSubtotal[];
  total: number;
};

function priceAtPosition(type: AttendeeType, position: number): number {
  const tiers = [...(type.graduatedPricing ?? [])].sort((a, b) => b.fromQty - a.fromQty);
  for (const tier of tiers) {
    if (position >= tier.fromQty) return tier.priceCents;
  }
  return type.priceCents;
}

export function calculateTotal(
  types: AttendeeType[],
  quantities: Record<string, number>,
): PriceCalculation {
  const perType: PerTypeSubtotal[] = [];
  let total = 0;
  for (const type of types) {
    const qty = quantities[type.id] ?? 0;
    if (qty <= 0) continue;
    const breakdown: PriceBreakdownItem[] = [];
    let subtotal = 0;
    for (let pos = 1; pos <= qty; pos++) {
      const price = priceAtPosition(type, pos);
      breakdown.push({ position: pos, priceCents: price });
      subtotal += price;
    }
    perType.push({ typeId: type.id, subtotal, breakdown });
    total += subtotal;
  }
  return { perType, total };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/pricing.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "feat(pricing): add calculateTotal with graduated pricing"
```

---

### Task 1.2: Attendee-type presets

**Files:**
- Create: `src/lib/attendee-presets.ts`
- Test: `src/lib/attendee-presets.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/attendee-presets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPresetTypes, PRESET_IDS } from "./attendee-presets";

describe("buildPresetTypes", () => {
  it("jedna_osoba: single type, qty 1..1, uses provided base price", () => {
    const types = buildPresetTypes("jedna_osoba", { basePriceCents: 15000 });
    expect(types).toHaveLength(1);
    expect(types[0]).toMatchObject({
      name: "Uczestnik",
      minQty: 1,
      maxQty: 1,
      priceCents: 15000,
    });
    expect(typeof types[0].id).toBe("string");
    expect(types[0].id.length).toBeGreaterThan(0);
  });

  it("rodzic_z_dziecmi: parent + child types with child preset having Wiek field", () => {
    const types = buildPresetTypes("rodzic_z_dziecmi", { basePriceCents: 0 });
    expect(types).toHaveLength(2);
    const parent = types.find((t) => t.name === "Rodzic")!;
    const child = types.find((t) => t.name === "Dziecko")!;
    expect(parent).toMatchObject({ minQty: 1, maxQty: 1 });
    expect(child).toMatchObject({ minQty: 1, maxQty: 5 });
    expect(child.customFields?.some((f) => f.label === "Wiek")).toBe(true);
  });

  it("grupa: single type with qty 1..10", () => {
    const types = buildPresetTypes("grupa", { basePriceCents: 0 });
    expect(types).toHaveLength(1);
    expect(types[0]).toMatchObject({ minQty: 1, maxQty: 10, name: "Uczestnik" });
  });

  it("exports a list of preset ids", () => {
    expect(PRESET_IDS).toEqual(["jedna_osoba", "rodzic_z_dziecmi", "grupa"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/attendee-presets.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the presets module**

Create `src/lib/attendee-presets.ts`:

```ts
import { newId } from "./ids";
import type { AttendeeType } from "./validators/attendee-types";

export const PRESET_IDS = ["jedna_osoba", "rodzic_z_dziecmi", "grupa"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export type PresetContext = {
  basePriceCents: number;
};

export function buildPresetTypes(preset: PresetId, ctx: PresetContext): AttendeeType[] {
  if (preset === "jedna_osoba") {
    return [
      {
        id: newId(),
        name: "Uczestnik",
        minQty: 1,
        maxQty: 1,
        priceCents: ctx.basePriceCents,
      },
    ];
  }
  if (preset === "rodzic_z_dziecmi") {
    return [
      {
        id: newId(),
        name: "Rodzic",
        minQty: 1,
        maxQty: 1,
        priceCents: 0,
      },
      {
        id: newId(),
        name: "Dziecko",
        minQty: 1,
        maxQty: 5,
        priceCents: 0,
        customFields: [
          { id: newId(), label: "Wiek", type: "number", required: true },
        ],
      },
    ];
  }
  // grupa
  return [
    {
      id: newId(),
      name: "Uczestnik",
      minQty: 1,
      maxQty: 10,
      priceCents: ctx.basePriceCents,
    },
  ];
}

export const PRESET_LABELS: Record<PresetId, { title: string; description: string }> = {
  jedna_osoba: {
    title: "Jedna osoba",
    description: "Standardowa rejestracja, jedna osoba na zgłoszenie.",
  },
  rodzic_z_dziecmi: {
    title: "Rodzic z dziećmi",
    description: "Rodzic zapisuje siebie i swoje dzieci.",
  },
  grupa: {
    title: "Grupa / zespół",
    description: "Jedna osoba zapisuje kilku uczestników.",
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/attendee-presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attendee-presets.ts src/lib/attendee-presets.test.ts
git commit -m "feat(presets): add attendee-type presets"
```

---

## Phase 2 — Capacity

### Task 2.1: Count active attendees instead of participants

**Files:**
- Modify: `src/lib/capacity.ts`
- Modify: `src/lib/capacity.test.ts`

- [ ] **Step 1: Extend `computeSpotsTaken` signature**

Replace the body of `src/lib/capacity.ts` with:

```ts
import { eq, isNull, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  derivedStatus,
  type DerivedStatus,
  type ParticipantLike,
  type PaymentLike,
} from "@/lib/participant-status";

const TAKEN: DerivedStatus[] = ["pending", "deposit_paid", "paid", "overdue"];

export type SpotsInput = {
  participant: ParticipantLike;
  payments: PaymentLike[];
  /** Number of non-cancelled attendees in this registration. 0 means "legacy" — counts as 1. */
  activeAttendees: number;
};

export function computeSpotsTaken(rows: SpotsInput[], nowMs: number): number {
  let taken = 0;
  for (const r of rows) {
    if (!TAKEN.includes(derivedStatus(r.participant, r.payments, nowMs))) continue;
    // Legacy registrations (no attendees row) still count as 1 spot (the registrant).
    taken += r.activeAttendees > 0 ? r.activeAttendees : 1;
  }
  return taken;
}

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

  const attendeeRows = await db
    .select({ participantId: schema.attendees.participantId })
    .from(schema.attendees)
    .innerJoin(schema.participants, eq(schema.attendees.participantId, schema.participants.id))
    .where(and(eq(schema.participants.eventId, eventId), isNull(schema.attendees.cancelledAt)));

  const paymentsByParticipant = new Map<string, PaymentLike[]>();
  for (const pr of paymentRows) {
    const list = paymentsByParticipant.get(pr.participantId) ?? [];
    list.push({
      kind: pr.kind as PaymentLike["kind"],
      status: pr.status as PaymentLike["status"],
      dueAt: pr.dueAt,
    });
    paymentsByParticipant.set(pr.participantId, list);
  }

  const attendeeCountByParticipant = new Map<string, number>();
  for (const a of attendeeRows) {
    attendeeCountByParticipant.set(a.participantId, (attendeeCountByParticipant.get(a.participantId) ?? 0) + 1);
  }

  const rows: SpotsInput[] = participantRows.map((p) => ({
    participant: { lifecycleStatus: p.lifecycleStatus as ParticipantLike["lifecycleStatus"] },
    payments: paymentsByParticipant.get(p.id) ?? [],
    activeAttendees: attendeeCountByParticipant.get(p.id) ?? 0,
  }));
  return computeSpotsTaken(rows, nowMs);
}
```

- [ ] **Step 2: Update existing tests and add new ones**

Replace `src/lib/capacity.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { computeSpotsTaken } from "./capacity";
import type { ParticipantLike, PaymentLike } from "./participant-status";

const NOW = 1_000_000_000_000;

const lc = (s: ParticipantLike["lifecycleStatus"]): ParticipantLike => ({ lifecycleStatus: s });
const pay = (over: Partial<PaymentLike> = {}): PaymentLike => ({
  kind: "full",
  status: "pending",
  dueAt: null,
  ...over,
});

describe("computeSpotsTaken", () => {
  it("counts legacy registrations (no attendees) as 1 spot each", () => {
    const rows = [
      { participant: lc("active"), payments: [pay({ status: "pending" })], activeAttendees: 0 },
      { participant: lc("active"), payments: [pay({ kind: "deposit", status: "succeeded" })], activeAttendees: 0 },
      { participant: lc("active"), payments: [pay({ kind: "full", status: "succeeded" })], activeAttendees: 0 },
      {
        participant: lc("active"),
        payments: [
          pay({ kind: "deposit", status: "succeeded" }),
          pay({ kind: "balance", status: "expired", dueAt: NOW - 1 }),
        ],
        activeAttendees: 0,
      },
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(4);
  });

  it("counts each active attendee toward capacity", () => {
    const rows = [
      { participant: lc("active"), payments: [pay({ status: "succeeded" })], activeAttendees: 3 },
      { participant: lc("active"), payments: [pay({ status: "pending" })], activeAttendees: 2 },
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(5);
  });

  it("does not count waitlisted, cancelled, refunded — even with attendees", () => {
    const rows = [
      { participant: lc("waitlisted"), payments: [], activeAttendees: 3 },
      { participant: lc("cancelled"), payments: [pay({ status: "succeeded" })], activeAttendees: 3 },
      { participant: lc("active"), payments: [pay({ status: "refunded" })], activeAttendees: 3 },
      { participant: lc("active"), payments: [pay({ status: "expired" })], activeAttendees: 3 },
    ];
    expect(computeSpotsTaken(rows, NOW)).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/capacity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Type-check the rest of the codebase**

Run: `npx tsc --noEmit`
Expected: TypeScript may flag callers of `computeSpotsTaken` that don't pass `activeAttendees`. Fix any affected callers (search for `computeSpotsTaken` with Grep). The DB-backed `countTakenSpots` callers should need no change since its signature is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capacity.ts src/lib/capacity.test.ts
git commit -m "feat(capacity): count each active attendee as a spot"
```

---

### Task 2.2: Attendee queries

**Files:**
- Create: `src/lib/db/queries/attendees.ts`

- [ ] **Step 1: Write the queries module**

Create `src/lib/db/queries/attendees.ts`:

```ts
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { Attendee, NewAttendee } from "@/lib/db/schema";

export async function insertAttendees(rows: NewAttendee[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();
  await db.insert(schema.attendees).values(rows);
}

export async function listActiveAttendeesForParticipant(
  participantId: string,
): Promise<Attendee[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.attendees)
    .where(
      and(
        eq(schema.attendees.participantId, participantId),
        isNull(schema.attendees.cancelledAt),
      ),
    )
    .all();
}

export async function listAttendeesForEvent(eventId: string): Promise<Attendee[]> {
  const db = getDb();
  return db
    .select({
      id: schema.attendees.id,
      participantId: schema.attendees.participantId,
      attendeeTypeId: schema.attendees.attendeeTypeId,
      firstName: schema.attendees.firstName,
      lastName: schema.attendees.lastName,
      customAnswers: schema.attendees.customAnswers,
      cancelledAt: schema.attendees.cancelledAt,
      createdAt: schema.attendees.createdAt,
    })
    .from(schema.attendees)
    .innerJoin(schema.participants, eq(schema.attendees.participantId, schema.participants.id))
    .where(eq(schema.participants.eventId, eventId))
    .all();
}

export async function softCancelAttendee(attendeeId: string, now: number): Promise<void> {
  const db = getDb();
  await db
    .update(schema.attendees)
    .set({ cancelledAt: now })
    .where(eq(schema.attendees.id, attendeeId));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries/attendees.ts
git commit -m "feat(db): add attendee queries"
```

---

## Phase 3 — Server-side registration flow

### Task 3.1: Update registration validator

**Files:**
- Modify: `src/lib/validators/registration.ts`
- Create: `src/lib/validators/attendees-form.ts`

- [ ] **Step 1: Create the per-attendee form schema**

Create `src/lib/validators/attendees-form.ts`:

```ts
import { z } from "zod";

export const attendeeFormRowSchema = z.object({
  attendeeTypeId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  customAnswers: z.record(z.string(), z.string()).default({}),
});
export type AttendeeFormRow = z.infer<typeof attendeeFormRowSchema>;

export const attendeesFormSchema = z.array(attendeeFormRowSchema).min(1).max(50);
```

- [ ] **Step 2: Extend registration schema**

Replace `src/lib/validators/registration.ts` with:

```ts
import { z } from "zod";
import { attendeesFormSchema } from "./attendees-form";

export const registrationBaseSchema = z.object({
  eventId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(32).optional(),
});

export const registrationWithAttendeesSchema = registrationBaseSchema.extend({
  attendees: attendeesFormSchema,
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validators/registration.ts src/lib/validators/attendees-form.ts
git commit -m "feat(validators): extend registration with attendees"
```

---

### Task 3.2: Extend `processRegistration` for attendees

**Files:**
- Modify: `src/lib/register/process-registration.ts`

- [ ] **Step 1: Add imports and attendee parser**

At the top of `src/lib/register/process-registration.ts`, add imports:

```ts
import type { AttendeeType } from "@/lib/validators/attendee-types";
import type { AttendeeFormRow } from "@/lib/validators/attendees-form";
import { attendeesFormSchema } from "@/lib/validators/attendees-form";
import { calculateTotal } from "@/lib/pricing";
import { insertAttendees } from "@/lib/db/queries/attendees";
```

Below `recordParticipantConsents`, add a helper:

```ts
/**
 * Parse attendee rows from FormData. Form convention:
 *   attendees[i][attendeeTypeId]
 *   attendees[i][firstName]
 *   attendees[i][lastName]
 *   attendees[i][field_<customFieldId>]
 */
function parseAttendeesFromForm(
  form: FormData,
  types: AttendeeType[],
): { rows: AttendeeFormRow[]; errors: Record<string, string> } {
  const rowsByIdx = new Map<number, Partial<AttendeeFormRow> & { customAnswers: Record<string, string> }>();
  const errors: Record<string, string> = {};

  for (const [key, value] of form.entries()) {
    const m = key.match(/^attendees\[(\d+)\]\[([^\]]+)\]$/);
    if (!m) continue;
    const idx = Number(m[1]);
    const field = m[2];
    const v = String(value);
    const existing = rowsByIdx.get(idx) ?? { customAnswers: {} };
    if (field === "attendeeTypeId") existing.attendeeTypeId = v;
    else if (field === "firstName") existing.firstName = v;
    else if (field === "lastName") existing.lastName = v;
    else if (field.startsWith("field_")) existing.customAnswers[field.slice("field_".length)] = v;
    rowsByIdx.set(idx, existing);
  }

  const rows = [...rowsByIdx.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, r]) => r as AttendeeFormRow);

  // Validate required per-type custom fields.
  for (const [i, row] of rows.entries()) {
    const type = types.find((t) => t.id === row.attendeeTypeId);
    if (!type) {
      errors[`attendees[${i}]`] = "Nieznany typ uczestnika.";
      continue;
    }
    for (const f of type.customFields ?? []) {
      if (f.required) {
        const val = row.customAnswers?.[f.id];
        if (!val || val.trim() === "") {
          errors[`attendees[${i}][field_${f.id}]`] = "To pole jest wymagane.";
        }
      }
    }
  }

  return { rows, errors };
}

function getAttendeeTypes(event: { attendeeTypes: string | null; priceCents: number }): AttendeeType[] {
  if (event.attendeeTypes) {
    try {
      return JSON.parse(event.attendeeTypes) as AttendeeType[];
    } catch {
      // fall through to legacy path
    }
  }
  // Legacy implicit single type — one attendee, qty 1/1, event price.
  return [
    {
      id: "__legacy__",
      name: "Uczestnik",
      minQty: 1,
      maxQty: 1,
      priceCents: event.priceCents,
    },
  ];
}

function validateAttendeeCountsAgainstTypes(
  rows: AttendeeFormRow[],
  types: AttendeeType[],
): Record<string, string> {
  const errs: Record<string, string> = {};
  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.attendeeTypeId, (byType.get(r.attendeeTypeId) ?? 0) + 1);
  for (const t of types) {
    const qty = byType.get(t.id) ?? 0;
    if (qty < t.minQty) errs[`attendee_type_${t.id}`] = `Wymagana minimalna liczba: ${t.minQty}.`;
    if (qty > t.maxQty) errs[`attendee_type_${t.id}`] = `Przekroczona maksymalna liczba: ${t.maxQty}.`;
  }
  return errs;
}
```

- [ ] **Step 2: Replace the validation/calculation block in `processRegistration`**

Locate the section inside `processRegistration` starting at `const parsed = registrationBaseSchema.safeParse(...)` through the payment-creation block. Rework it as follows. Leave the organizer/Stripe/waitlist/emails code intact — only the registrant parsing, the attendees handling, and the payment amount change.

Replace lines around the current `parsed`/`questions`/`answers`/`taken`/`isFull`/payment block with:

```ts
  const parsedRegistrant = registrationBaseSchema.safeParse({
    eventId: form.get("eventId"),
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    email: form.get("email"),
    phone: form.get("phone") || undefined,
  });
  if (!parsedRegistrant.success) return { errors: zodIssuesToRecord(parsedRegistrant.error.issues) };

  const subdomain = String(form.get("organizerSubdomain") ?? "");
  const slug = String(form.get("eventSlug") ?? "");
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) return { errors: { _form: "Nie znaleziono organizatora." } };

  if (
    !organizer.stripeAccountId ||
    organizer.stripeOnboardingComplete !== 1 ||
    organizer.stripePayoutsEnabled !== 1
  ) {
    return { errors: { _form: "Rejestracja chwilowo niedostępna." } };
  }

  const event = await getPublishedEventBySlug(organizer.id, slug);
  if (!event || event.id !== parsedRegistrant.data.eventId) {
    return { errors: { _form: "Nie znaleziono wydarzenia." } };
  }

  const attendeeTypes = getAttendeeTypes(event);

  // If legacy (no attendeeTypes JSON), synthesize a single attendee from the registrant.
  const isLegacyMode = !event.attendeeTypes;
  let attendeeRows: AttendeeFormRow[];
  let attendeeErrors: Record<string, string> = {};
  if (isLegacyMode) {
    attendeeRows = [
      {
        attendeeTypeId: attendeeTypes[0].id,
        firstName: parsedRegistrant.data.firstName,
        lastName: parsedRegistrant.data.lastName,
        customAnswers: {},
      },
    ];
  } else {
    const parsedAttendees = parseAttendeesFromForm(form, attendeeTypes);
    if (Object.keys(parsedAttendees.errors).length > 0) {
      return { errors: parsedAttendees.errors };
    }
    const shapeCheck = attendeesFormSchema.safeParse(parsedAttendees.rows);
    if (!shapeCheck.success) {
      return { errors: zodIssuesToRecord(shapeCheck.error.issues) };
    }
    attendeeRows = shapeCheck.data;
    attendeeErrors = validateAttendeeCountsAgainstTypes(attendeeRows, attendeeTypes);
    if (Object.keys(attendeeErrors).length > 0) return { errors: attendeeErrors };
  }

  // Event-level custom questions (per-registration, unchanged).
  const questions: CustomQuestion[] = event.customQuestions
    ? JSON.parse(event.customQuestions)
    : [];
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const v = form.get(`q_${q.id}`);
    if (q.required && (!v || String(v).trim() === ""))
      errors[`q_${q.id}`] = "To pole jest wymagane.";
  }

  // Consent validation (unchanged from previous implementation).
  const consents: ConsentConfigItem[] = event.consentConfig
    ? JSON.parse(event.consentConfig)
    : [];
  if (form.get("consent_regulamin") !== "true") {
    errors.consent_regulamin = "Akceptacja regulaminu jest wymagana.";
  }
  if (form.get("consent_privacy") !== "true") {
    errors.consent_privacy = "Zapoznanie się z polityką prywatności jest wymagane.";
  }
  for (const consent of consents) {
    if (consent.required && form.get(`consent_${consent.id}`) !== "true") {
      errors[`consent_${consent.id}`] = "Ta zgoda jest wymagana.";
    }
  }
  if (Object.keys(errors).length > 0) return { errors };

  const answers: Record<string, string> = {};
  for (const q of questions) {
    const v = form.get(`q_${q.id}`);
    if (v) answers[q.id] = String(v);
  }

  const quantities: Record<string, number> = {};
  for (const r of attendeeRows) quantities[r.attendeeTypeId] = (quantities[r.attendeeTypeId] ?? 0) + 1;
  const priceCalc = calculateTotal(attendeeTypes, quantities);
  const totalCents = priceCalc.total;
  if (totalCents < 0) return { errors: { _form: "Nieprawidłowa cena." } };

  const requestedSpots = attendeeRows.length;
  const now = Date.now();
  const taken = await countTakenSpots(event.id, now);
  const isFull = taken + requestedSpots > event.capacity;
```

- [ ] **Step 3: Update insertions for the happy path (active)**

Find the block where `insertParticipant(..., lifecycleStatus: "active", ...)` is called, and immediately after it, before the `recordParticipantConsents` call, add:

```ts
  if (!isLegacyMode) {
    await insertAttendees(
      attendeeRows.map((r) => ({
        id: newId(),
        participantId,
        attendeeTypeId: r.attendeeTypeId,
        firstName: r.firstName,
        lastName: r.lastName,
        customAnswers: JSON.stringify(r.customAnswers),
        cancelledAt: null,
        createdAt: now,
      })),
    );
  }
```

- [ ] **Step 4: Update insertions for the waitlisted path**

Do the same immediately after `insertParticipant(..., lifecycleStatus: "waitlisted", ...)`:

```ts
  if (!isLegacyMode) {
    await insertAttendees(
      attendeeRows.map((r) => ({
        id: newId(),
        participantId,
        attendeeTypeId: r.attendeeTypeId,
        firstName: r.firstName,
        lastName: r.lastName,
        customAnswers: JSON.stringify(r.customAnswers),
        cancelledAt: null,
        createdAt: now,
      })),
    );
  }
```

- [ ] **Step 5: Use `totalCents` as the pricing basis**

Replace the deposit/payment block (currently using `event.priceCents` / `event.depositCents`) so that the `paymentAmount` derives from `totalCents`:

```ts
  const depositCents = event.depositCents ?? 0;
  const effectiveDeposit = Math.min(depositCents, totalCents);
  const depositMode = effectiveDeposit > 0 && effectiveDeposit < totalCents;
  const paymentId = newId();
  const paymentKind: "deposit" | "full" = depositMode ? "deposit" : "full";
  const paymentAmount = depositMode ? effectiveDeposit : totalCents;
```

And pass `paymentAmount` into the Stripe line item as `unit_amount` (already the shape of the existing code — just ensure it points at the new variable).

- [ ] **Step 6: Rename remaining `parsed.data` references**

Search within the file for `parsed.data` and rename to `parsedRegistrant.data`:

Run: `grep -n "parsed\.data" src/lib/register/process-registration.ts`
Replace each occurrence accordingly.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/register/process-registration.ts
git commit -m "feat(register): support multi-attendee registrations server-side"
```

---

## Phase 4 — Registrant-side registration form

### Task 4.1: Price summary component

**Files:**
- Create: `src/app/sites/[subdomain]/[eventSlug]/register/price-summary.tsx`

- [ ] **Step 1: Implement the component**

Create `src/app/sites/[subdomain]/[eventSlug]/register/price-summary.tsx`:

```tsx
"use client";
import { calculateTotal } from "@/lib/pricing";
import type { AttendeeType } from "@/lib/validators/attendee-types";

type Props = {
  types: AttendeeType[];
  quantities: Record<string, number>;
  depositCents: number | null;
  currency?: string;
};

function formatPLN(cents: number): string {
  return (cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł";
}

export function PriceSummary({ types, quantities, depositCents }: Props) {
  const calc = calculateTotal(types, quantities);
  if (calc.total === 0) return null;

  const rows = calc.perType.map((pt) => {
    const type = types.find((t) => t.id === pt.typeId)!;
    return {
      name: type.name,
      qty: pt.breakdown.length,
      subtotal: pt.subtotal,
    };
  });

  const deposit = depositCents && depositCents > 0 && depositCents < calc.total ? depositCents : null;

  return (
    <div className="rounded-md border p-4 bg-gray-50">
      <h3 className="font-semibold mb-2">Podsumowanie</h3>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.name} className="flex justify-between">
            <span>{r.name} × {r.qty}</span>
            <span>{formatPLN(r.subtotal)}</span>
          </li>
        ))}
        <li className="flex justify-between font-semibold pt-2 border-t">
          <span>Razem</span>
          <span>{formatPLN(calc.total)}</span>
        </li>
        {deposit !== null && (
          <li className="text-xs text-gray-600 pt-1">
            Zaliczka: {formatPLN(deposit)} · Dopłata: {formatPLN(calc.total - deposit)}
          </li>
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sites/[subdomain]/[eventSlug]/register/price-summary.tsx
git commit -m "feat(register): add live price summary component"
```

---

### Task 4.2: Attendee card component

**Files:**
- Create: `src/app/sites/[subdomain]/[eventSlug]/register/AttendeeCard.tsx`

- [ ] **Step 1: Implement the card**

Create `src/app/sites/[subdomain]/[eventSlug]/register/AttendeeCard.tsx`:

```tsx
"use client";
import type { AttendeeType } from "@/lib/validators/attendee-types";

type Props = {
  index: number; // position in form (attendees[N])
  type: AttendeeType;
  label: string; // "Dziecko 1"
  canRemove: boolean;
  onRemove?: () => void;
  value: { firstName: string; lastName: string; customAnswers: Record<string, string> };
  onChange: (next: { firstName: string; lastName: string; customAnswers: Record<string, string> }) => void;
  errors: Record<string, string>;
};

export function AttendeeCard({ index, type, label, canRemove, onRemove, value, onChange, errors }: Props) {
  function setField<K extends "firstName" | "lastName">(k: K, v: string) {
    onChange({ ...value, [k]: v });
  }
  function setCustom(id: string, v: string) {
    onChange({ ...value, customAnswers: { ...value.customAnswers, [id]: v } });
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{label}</div>
        {canRemove && (
          <button type="button" className="text-sm text-red-600 underline" onClick={onRemove}>
            Usuń
          </button>
        )}
      </div>

      {/* Hidden type id for form POST */}
      <input type="hidden" name={`attendees[${index}][attendeeTypeId]`} value={type.id} />

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm flex flex-col">
          Imię
          <input
            name={`attendees[${index}][firstName]`}
            value={value.firstName}
            onChange={(e) => setField("firstName", e.target.value)}
            className="border rounded px-2 py-1"
            required
          />
          {errors[`attendees[${index}][firstName]`] && (
            <span className="text-red-600 text-xs">{errors[`attendees[${index}][firstName]`]}</span>
          )}
        </label>
        <label className="text-sm flex flex-col">
          Nazwisko
          <input
            name={`attendees[${index}][lastName]`}
            value={value.lastName}
            onChange={(e) => setField("lastName", e.target.value)}
            className="border rounded px-2 py-1"
            required
          />
          {errors[`attendees[${index}][lastName]`] && (
            <span className="text-red-600 text-xs">{errors[`attendees[${index}][lastName]`]}</span>
          )}
        </label>
      </div>

      {(type.customFields ?? []).map((f) => (
        <label key={f.id} className="text-sm flex flex-col">
          {f.label} {f.required && <span className="text-red-600">*</span>}
          {f.type === "long_text" ? (
            <textarea
              name={`attendees[${index}][field_${f.id}]`}
              value={value.customAnswers[f.id] ?? ""}
              onChange={(e) => setCustom(f.id, e.target.value)}
              className="border rounded px-2 py-1"
              required={f.required}
            />
          ) : f.type === "select" ? (
            <select
              name={`attendees[${index}][field_${f.id}]`}
              value={value.customAnswers[f.id] ?? ""}
              onChange={(e) => setCustom(f.id, e.target.value)}
              className="border rounded px-2 py-1"
              required={f.required}
            >
              <option value="">—</option>
              {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              name={`attendees[${index}][field_${f.id}]`}
              value={value.customAnswers[f.id] ?? ""}
              onChange={(e) => setCustom(f.id, e.target.value)}
              className="border rounded px-2 py-1"
              required={f.required}
            />
          )}
          {errors[`attendees[${index}][field_${f.id}]`] && (
            <span className="text-red-600 text-xs">{errors[`attendees[${index}][field_${f.id}]`]}</span>
          )}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sites/[subdomain]/[eventSlug]/register/AttendeeCard.tsx
git commit -m "feat(register): add per-attendee card component"
```

---

### Task 4.3: Wire attendees into RegisterForm

**Files:**
- Modify: `src/app/sites/[subdomain]/[eventSlug]/register/RegisterForm.tsx`

- [ ] **Step 1: Read the current form**

Run: `cat src/app/sites/[subdomain]/[eventSlug]/register/RegisterForm.tsx`
Note where the registrant inputs (firstName, lastName, email, phone) are and where `customQuestions` render. Identify the submit button.

- [ ] **Step 2: Accept `attendeeTypes` as a prop**

Open the file. Add a prop for `attendeeTypes: AttendeeType[]` and `remainingSpots: number`. At the top, import:

```ts
import { useState, useMemo, useEffect } from "react";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { AttendeeCard } from "./AttendeeCard";
import { PriceSummary } from "./price-summary";
```

Add to the props type: `attendeeTypes: AttendeeType[]; remainingSpots: number; depositCents: number | null;`.

- [ ] **Step 3: Add attendee state**

Inside the component, initialize one row per `minQty` for each type (and pre-fill the first row of the first type with the registrant's firstName/lastName — bound to the same state):

```tsx
type AttendeeState = { attendeeTypeId: string; firstName: string; lastName: string; customAnswers: Record<string, string> };

function initialAttendees(types: AttendeeType[]): AttendeeState[] {
  const rows: AttendeeState[] = [];
  for (const t of types) {
    for (let i = 0; i < Math.max(1, t.minQty); i++) {
      rows.push({ attendeeTypeId: t.id, firstName: "", lastName: "", customAnswers: {} });
    }
  }
  return rows;
}
```

Inside the component:

```tsx
const [attendees, setAttendees] = useState<AttendeeState[]>(() => initialAttendees(attendeeTypes));
const [registrantFirst, setRegistrantFirst] = useState("");
const [registrantLast, setRegistrantLast] = useState("");

// Keep attendees[0] in sync with registrant name.
useEffect(() => {
  setAttendees((prev) => {
    if (prev.length === 0) return prev;
    if (prev[0].firstName === registrantFirst && prev[0].lastName === registrantLast) return prev;
    const next = [...prev];
    next[0] = { ...next[0], firstName: registrantFirst, lastName: registrantLast };
    return next;
  });
}, [registrantFirst, registrantLast]);

const quantities = useMemo(() => {
  const q: Record<string, number> = {};
  for (const a of attendees) q[a.attendeeTypeId] = (q[a.attendeeTypeId] ?? 0) + 1;
  return q;
}, [attendees]);

const totalAttendees = attendees.length;
const atCapacity = totalAttendees >= remainingSpots;

function addAttendee(typeId: string) {
  setAttendees((prev) => [...prev, { attendeeTypeId: typeId, firstName: "", lastName: "", customAnswers: {} }]);
}
function removeAttendee(idx: number) {
  setAttendees((prev) => prev.filter((_, i) => i !== idx));
}
function updateAttendee(idx: number, next: Omit<AttendeeState, "attendeeTypeId">) {
  setAttendees((prev) => prev.map((a, i) => (i === idx ? { ...a, ...next } : a)));
}
```

- [ ] **Step 4: Replace the rendered form body**

Replace the firstName/lastName inputs so they update `registrantFirst`/`registrantLast`. After the registrant contact block (email, phone), render:

```tsx
{attendeeTypes.length === 1 && attendeeTypes[0].minQty === 1 && attendeeTypes[0].maxQty === 1 ? (
  /* Single-attendee mode: no per-person cards, just render the custom fields inline under the registrant */
  (attendeeTypes[0].customFields ?? []).length > 0 && (
    <AttendeeCard
      index={0}
      type={attendeeTypes[0]}
      label={attendeeTypes[0].name}
      canRemove={false}
      value={attendees[0]}
      onChange={(next) => updateAttendee(0, next)}
      errors={errors}
    />
  )
) : (
  <>
    {attendees.map((a, i) => {
      const type = attendeeTypes.find((t) => t.id === a.attendeeTypeId)!;
      const sameTypeBefore = attendees.slice(0, i).filter((x) => x.attendeeTypeId === a.attendeeTypeId).length;
      const label = i === 0 ? type.name : `${type.name} ${sameTypeBefore + 1}`;
      const qtyOfType = quantities[a.attendeeTypeId] ?? 0;
      return (
        <AttendeeCard
          key={i}
          index={i}
          type={type}
          label={label}
          canRemove={i > 0 && qtyOfType > type.minQty}
          onRemove={() => removeAttendee(i)}
          value={a}
          onChange={(next) => updateAttendee(i, next)}
          errors={errors}
        />
      );
    })}

    <div className="flex flex-wrap gap-2">
      {attendeeTypes.map((t) => {
        const qty = quantities[t.id] ?? 0;
        if (qty >= t.maxQty) return null;
        if (atCapacity) return null;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => addAttendee(t.id)}
            className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
          >
            + Dodaj {t.name.toLowerCase()}
          </button>
        );
      })}
      {atCapacity && (
        <span className="text-sm text-gray-600">Pozostało {remainingSpots} wolnych miejsc.</span>
      )}
    </div>

    <PriceSummary types={attendeeTypes} quantities={quantities} depositCents={depositCents} />
  </>
)}
```

- [ ] **Step 5: Pass `attendeeTypes` and `remainingSpots` from the page**

Open `src/app/sites/[subdomain]/[eventSlug]/register/page.tsx`. Locate where the event is loaded and `<RegisterForm />` is rendered. Before rendering, compute:

```tsx
import { countTakenSpots } from "@/lib/capacity";
// inside the async component:
const now = Date.now();
const taken = await countTakenSpots(event.id, now);
const remainingSpots = Math.max(0, event.capacity - taken);

const attendeeTypes = event.attendeeTypes
  ? JSON.parse(event.attendeeTypes)
  : [{ id: "__legacy__", name: "Uczestnik", minQty: 1, maxQty: 1, priceCents: event.priceCents }];
```

Pass them as props:

```tsx
<RegisterForm
  ...
  attendeeTypes={attendeeTypes}
  remainingSpots={remainingSpots}
  depositCents={event.depositCents ?? null}
/>
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual smoke test (legacy event)**

Run: `npm run dev`
Open an existing (legacy) event's `/register` page. The form should look identical to before — no extra sections, no broken fields.

- [ ] **Step 8: Commit**

```bash
git add src/app/sites/[subdomain]/[eventSlug]/register/RegisterForm.tsx src/app/sites/[subdomain]/[eventSlug]/register/page.tsx
git commit -m "feat(register): render multi-attendee form when event has attendee types"
```

---

## Phase 5 — Organizer-side event configuration

### Task 5.1: Attendee types editor (advanced)

**Files:**
- Create: `src/app/dashboard/events/[id]/AttendeeTypesEditor.tsx`

- [ ] **Step 1: Implement the editor**

Create `src/app/dashboard/events/[id]/AttendeeTypesEditor.tsx`:

```tsx
"use client";
import { useState } from "react";
import type { AttendeeType } from "@/lib/validators/attendee-types";

type Props = {
  value: AttendeeType[];
  onChange: (next: AttendeeType[]) => void;
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function AttendeeTypesEditor({ value, onChange }: Props) {
  const [open, setOpen] = useState<number | null>(0);

  function update(idx: number, patch: Partial<AttendeeType>) {
    onChange(value.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function removeType(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function addType() {
    onChange([
      ...value,
      { id: uid(), name: "Nowy typ", minQty: 1, maxQty: 1, priceCents: 0 },
    ]);
  }

  return (
    <div className="space-y-3">
      {value.map((t, idx) => (
        <div key={t.id} className="border rounded-md">
          <button
            type="button"
            className="w-full flex justify-between px-3 py-2"
            onClick={() => setOpen(open === idx ? null : idx)}
          >
            <span>{t.name} ({t.minQty}–{t.maxQty}, {(t.priceCents / 100).toFixed(2)} zł)</span>
            <span>{open === idx ? "▾" : "▸"}</span>
          </button>
          {open === idx && (
            <div className="p-3 border-t space-y-3">
              <label className="text-sm flex flex-col">Nazwa
                <input value={t.name} onChange={(e) => update(idx, { name: e.target.value })} className="border rounded px-2 py-1" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-sm flex flex-col">Min
                  <input type="number" min={0} value={t.minQty} onChange={(e) => update(idx, { minQty: Number(e.target.value) })} className="border rounded px-2 py-1" />
                </label>
                <label className="text-sm flex flex-col">Max
                  <input type="number" min={1} value={t.maxQty} onChange={(e) => update(idx, { maxQty: Number(e.target.value) })} className="border rounded px-2 py-1" />
                </label>
                <label className="text-sm flex flex-col">Cena (gr)
                  <input type="number" min={0} value={t.priceCents} onChange={(e) => update(idx, { priceCents: Number(e.target.value) })} className="border rounded px-2 py-1" />
                </label>
              </div>

              <GraduatedPricingEditor type={t} onChange={(gp) => update(idx, { graduatedPricing: gp })} />
              <CustomFieldsEditor type={t} onChange={(cf) => update(idx, { customFields: cf })} />

              <button type="button" className="text-sm text-red-600 underline" onClick={() => removeType(idx)}>
                Usuń typ
              </button>
            </div>
          )}
        </div>
      ))}
      <button type="button" className="text-sm border rounded px-3 py-1" onClick={addType}>
        + Dodaj typ uczestnika
      </button>
    </div>
  );
}

function GraduatedPricingEditor({ type, onChange }: { type: AttendeeType; onChange: (t: AttendeeType["graduatedPricing"]) => void }) {
  const tiers = type.graduatedPricing ?? [];
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Zniżki dla kolejnych uczestników</div>
      {tiers.map((tier, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-sm">od</span>
          <input type="number" min={2} value={tier.fromQty}
            onChange={(e) => onChange(tiers.map((t, j) => j === i ? { ...t, fromQty: Number(e.target.value) } : t))}
            className="border rounded px-2 py-1 w-20" />
          <span className="text-sm">cena (gr)</span>
          <input type="number" min={0} value={tier.priceCents}
            onChange={(e) => onChange(tiers.map((t, j) => j === i ? { ...t, priceCents: Number(e.target.value) } : t))}
            className="border rounded px-2 py-1 w-28" />
          <button type="button" className="text-red-600 text-xs" onClick={() => onChange(tiers.filter((_, j) => j !== i))}>usuń</button>
        </div>
      ))}
      <button type="button" className="text-xs underline" onClick={() => onChange([...tiers, { fromQty: 2, priceCents: 0 }])}>
        + dodaj próg
      </button>
    </div>
  );
}

function CustomFieldsEditor({ type, onChange }: { type: AttendeeType; onChange: (t: AttendeeType["customFields"]) => void }) {
  const fields = type.customFields ?? [];
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Dodatkowe pola</div>
      {fields.map((f, i) => (
        <div key={f.id} className="flex gap-2 items-center flex-wrap">
          <input placeholder="Nazwa" value={f.label}
            onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
            className="border rounded px-2 py-1" />
          <select value={f.type}
            onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, type: e.target.value as typeof f.type } : x))}
            className="border rounded px-2 py-1">
            <option value="text">tekst</option>
            <option value="long_text">długi tekst</option>
            <option value="number">liczba</option>
            <option value="date">data</option>
            <option value="select">lista</option>
          </select>
          <label className="text-xs">
            <input type="checkbox" checked={f.required}
              onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} />
            wymagane
          </label>
          <button type="button" className="text-red-600 text-xs" onClick={() => onChange(fields.filter((_, j) => j !== i))}>usuń</button>
        </div>
      ))}
      <button type="button" className="text-xs underline"
        onClick={() => onChange([...fields, { id: uid(), label: "Nowe pole", type: "text", required: false }])}>
        + dodaj pole
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/events/[id]/AttendeeTypesEditor.tsx
git commit -m "feat(dashboard): add advanced attendee types editor"
```

---

### Task 5.2: Preset picker with attendee-types field

**Files:**
- Create: `src/app/dashboard/events/[id]/attendee-types-field.tsx`

- [ ] **Step 1: Implement the preset picker**

Create `src/app/dashboard/events/[id]/attendee-types-field.tsx`:

```tsx
"use client";
import { useState } from "react";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { PRESET_IDS, PRESET_LABELS, buildPresetTypes, type PresetId } from "@/lib/attendee-presets";
import { AttendeeTypesEditor } from "./AttendeeTypesEditor";

type Props = {
  initialAttendeeTypes: AttendeeType[] | null;
  basePriceCents: number;
  name?: string; // hidden input name, defaults to "attendeeTypes"
};

function detectPreset(types: AttendeeType[] | null): PresetId | "custom" {
  if (!types || types.length === 0) return "jedna_osoba";
  if (types.length === 1 && types[0].maxQty === 1) return "jedna_osoba";
  if (types.length === 1 && types[0].maxQty > 1) return "grupa";
  if (
    types.length === 2 &&
    types.some((t) => t.name.toLowerCase() === "rodzic") &&
    types.some((t) => t.name.toLowerCase() === "dziecko")
  ) {
    return "rodzic_z_dziecmi";
  }
  return "custom";
}

export function AttendeeTypesField({ initialAttendeeTypes, basePriceCents, name = "attendeeTypes" }: Props) {
  const [preset, setPreset] = useState<PresetId | "custom">(() => detectPreset(initialAttendeeTypes));
  const [types, setTypes] = useState<AttendeeType[]>(() => {
    if (initialAttendeeTypes && initialAttendeeTypes.length > 0) return initialAttendeeTypes;
    return buildPresetTypes("jedna_osoba", { basePriceCents });
  });

  function applyPreset(p: PresetId | "custom") {
    setPreset(p);
    if (p === "custom") return; // keep current
    setTypes(buildPresetTypes(p, { basePriceCents }));
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold">Kto bierze udział?</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {PRESET_IDS.map((p) => {
          const meta = PRESET_LABELS[p];
          const active = preset === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={`border rounded-md p-3 text-left ${active ? "border-black bg-gray-50" : "border-gray-300"}`}
            >
              <div className="font-semibold text-sm">{meta.title}</div>
              <div className="text-xs text-gray-600">{meta.description}</div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="text-xs underline text-gray-600"
        onClick={() => setPreset("custom")}
      >
        {preset === "custom" ? "Używasz własnej konfiguracji" : "Potrzebujesz innej konfiguracji? Utwórz własną →"}
      </button>

      {preset === "rodzic_z_dziecmi" && (
        <RodzicPresetFields types={types} onChange={setTypes} />
      )}
      {preset === "grupa" && (
        <GrupaPresetFields types={types} onChange={setTypes} />
      )}
      {preset === "jedna_osoba" && (
        <JednaOsobaPresetFields types={types} onChange={setTypes} />
      )}
      {preset === "custom" && (
        <AttendeeTypesEditor value={types} onChange={setTypes} />
      )}

      <input type="hidden" name={name} value={JSON.stringify(types)} />
    </div>
  );
}

function JednaOsobaPresetFields({ types, onChange }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void }) {
  const t = types[0];
  return (
    <label className="text-sm flex flex-col max-w-xs">
      Cena (gr)
      <input
        type="number"
        min={0}
        value={t.priceCents}
        onChange={(e) => onChange([{ ...t, priceCents: Number(e.target.value) }])}
        className="border rounded px-2 py-1"
      />
    </label>
  );
}

function GrupaPresetFields({ types, onChange }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void }) {
  const t = types[0];
  return (
    <div className="space-y-2">
      <label className="text-sm flex flex-col max-w-xs">
        Cena za uczestnika (gr)
        <input type="number" min={0} value={t.priceCents}
          onChange={(e) => onChange([{ ...t, priceCents: Number(e.target.value) }])}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex flex-col max-w-xs">
        Maksymalna liczba uczestników
        <input type="number" min={1} max={50} value={t.maxQty}
          onChange={(e) => onChange([{ ...t, maxQty: Number(e.target.value) }])}
          className="border rounded px-2 py-1" />
      </label>
    </div>
  );
}

function RodzicPresetFields({ types, onChange }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void }) {
  const parent = types.find((t) => t.name.toLowerCase() === "rodzic") ?? types[0];
  const child = types.find((t) => t.name.toLowerCase() === "dziecko") ?? types[1];
  const discount = child.graduatedPricing?.[0];

  function setParentPrice(v: number) {
    onChange(types.map((t) => (t.id === parent.id ? { ...t, priceCents: v } : t)));
  }
  function setChildPrice(v: number) {
    onChange(types.map((t) => (t.id === child.id ? { ...t, priceCents: v } : t)));
  }
  function setChildMax(v: number) {
    onChange(types.map((t) => (t.id === child.id ? { ...t, maxQty: v } : t)));
  }
  function toggleDiscount(on: boolean) {
    onChange(types.map((t) => {
      if (t.id !== child.id) return t;
      return { ...t, graduatedPricing: on ? [{ fromQty: 2, priceCents: 0 }] : undefined };
    }));
  }
  function setDiscountFrom(v: number) {
    onChange(types.map((t) => {
      if (t.id !== child.id) return t;
      const tier = (t.graduatedPricing ?? [{ fromQty: 2, priceCents: 0 }])[0];
      return { ...t, graduatedPricing: [{ ...tier, fromQty: v }] };
    }));
  }
  function setDiscountPrice(v: number) {
    onChange(types.map((t) => {
      if (t.id !== child.id) return t;
      const tier = (t.graduatedPricing ?? [{ fromQty: 2, priceCents: 0 }])[0];
      return { ...t, graduatedPricing: [{ ...tier, priceCents: v }] };
    }));
  }

  return (
    <div className="space-y-3">
      <label className="text-sm flex flex-col max-w-xs">
        Cena Rodzica (gr)
        <input type="number" min={0} value={parent.priceCents}
          onChange={(e) => setParentPrice(Number(e.target.value))}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex flex-col max-w-xs">
        Cena za Dziecko (gr)
        <input type="number" min={0} value={child.priceCents}
          onChange={(e) => setChildPrice(Number(e.target.value))}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex flex-col max-w-xs">
        Maksymalna liczba dzieci
        <input type="number" min={1} max={10} value={child.maxQty}
          onChange={(e) => setChildMax(Number(e.target.value))}
          className="border rounded px-2 py-1" />
      </label>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={!!discount} onChange={(e) => toggleDiscount(e.target.checked)} />
        Zniżka dla kolejnych dzieci
      </label>
      {discount && (
        <div className="flex gap-2 items-center">
          <span className="text-sm">od</span>
          <input type="number" min={2} value={discount.fromQty}
            onChange={(e) => setDiscountFrom(Number(e.target.value))}
            className="border rounded px-2 py-1 w-20" />
          <span className="text-sm">-go dziecka, cena (gr)</span>
          <input type="number" min={0} value={discount.priceCents}
            onChange={(e) => setDiscountPrice(Number(e.target.value))}
            className="border rounded px-2 py-1 w-28" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/events/[id]/attendee-types-field.tsx
git commit -m "feat(dashboard): add Kto bierze udział preset picker"
```

---

### Task 5.3: Wire attendee-types field into event forms

**Files:**
- Modify: `src/app/dashboard/events/[id]/EventEditForm.tsx`
- Modify: `src/app/dashboard/events/new/page.tsx`
- Modify: `src/app/dashboard/events/[id]/actions.ts`
- Modify: `src/lib/db/queries/events.ts` (if attendeeTypes not already selected)

- [ ] **Step 1: Ensure `attendeeTypes` is selected in event queries**

Open `src/lib/db/queries/events.ts` and check any `.select({ ... })` projections returning event rows. If any project specific columns (not `select().from()`), add `attendeeTypes: schema.events.attendeeTypes` to them. If they use the default `select().from()`, nothing to do.

- [ ] **Step 2: Render the preset picker in the edit form**

Open `src/app/dashboard/events/[id]/EventEditForm.tsx`. At the top, import:

```ts
import { AttendeeTypesField } from "./attendee-types-field";
import type { AttendeeType } from "@/lib/validators/attendee-types";
```

Accept the initial value as a prop: in the component's props type, add `initialAttendeeTypes: AttendeeType[] | null`.

Inside the form, add the section (e.g., after the "Cena" input group):

```tsx
<AttendeeTypesField
  initialAttendeeTypes={initialAttendeeTypes}
  basePriceCents={initialPriceCents /* use the current event price as base default */}
/>
```

At the call site (the parent page that renders `EventEditForm`), parse and pass:

```ts
const initialAttendeeTypes = event.attendeeTypes ? JSON.parse(event.attendeeTypes) : null;
```

- [ ] **Step 3: Same wiring in `new/page.tsx`**

Open `src/app/dashboard/events/new/page.tsx`. Add an `AttendeeTypesField` with `initialAttendeeTypes={null}` and `basePriceCents` tied to the current "price" input state (or simply `0` for new events).

- [ ] **Step 4: Persist `attendeeTypes` in the save action**

Open `src/app/dashboard/events/[id]/actions.ts`. In the form handler that updates/creates an event, read `formData.get("attendeeTypes")`, parse with `attendeeTypesSchema`, and pass to the DB update. Example:

```ts
import { attendeeTypesSchema } from "@/lib/validators/attendee-types";
// ...
const rawAttendeeTypes = String(formData.get("attendeeTypes") ?? "");
let attendeeTypesJson: string | null = null;
if (rawAttendeeTypes) {
  const parsed = attendeeTypesSchema.safeParse(JSON.parse(rawAttendeeTypes));
  if (!parsed.success) return { errors: { attendeeTypes: "Niepoprawna konfiguracja." } };
  attendeeTypesJson = JSON.stringify(parsed.data);
}
// then include `attendeeTypes: attendeeTypesJson` in the DB update payload.
```

If there is a create-event action in a different file, apply the same change there.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`
- Create a new event, pick "Rodzic z dziećmi," fill prices, save. Re-open — the preset should be detected and re-hydrate with the saved values.
- Switch to "Własna konfiguracja" on an existing event, modify, save. Confirm changes persist.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/events/[id]/EventEditForm.tsx src/app/dashboard/events/new/page.tsx src/app/dashboard/events/[id]/actions.ts src/lib/db/queries/events.ts
git commit -m "feat(dashboard): wire attendee types into event create/edit"
```

---

## Phase 6 — Dashboard participant list (group display & per-attendee removal)

### Task 6.1: Group row component

**Files:**
- Create: `src/app/dashboard/events/[id]/participants/AttendeeGroupRow.tsx`

- [ ] **Step 1: Implement the row**

Create `src/app/dashboard/events/[id]/participants/AttendeeGroupRow.tsx`:

```tsx
"use client";
import { useState } from "react";
import type { Attendee } from "@/lib/db/schema";

type Registrant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  derivedStatus: string;
  totalCents: number;
};

type AttendeeWithTypeName = Attendee & { typeName: string };

type Props = {
  registrant: Registrant;
  attendees: AttendeeWithTypeName[];
  onRemoveAttendee?: (attendeeId: string) => void;
  onCancelRegistration?: () => void;
};

function formatPLN(cents: number): string {
  return (cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł";
}

export function AttendeeGroupRow({ registrant, attendees, onRemoveAttendee, onCancelRegistration }: Props) {
  const [open, setOpen] = useState(attendees.length === 1);
  const activeAttendees = attendees.filter((a) => a.cancelledAt == null);
  const hasMultiple = activeAttendees.length > 1;

  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 text-left">
          <span className="font-semibold">{registrant.lastName} {registrant.firstName}</span>
          <span className="text-gray-500 ml-2">({registrant.email})</span>
          {hasMultiple && <span className="ml-2 text-xs bg-gray-200 rounded px-2">{activeAttendees.length} osób</span>}
        </button>
        <div className="text-sm text-gray-700">{formatPLN(registrant.totalCents)}</div>
        <div className="ml-3 text-sm">{registrant.derivedStatus}</div>
        {onCancelRegistration && (
          <button type="button" className="ml-3 text-sm text-red-600 underline" onClick={onCancelRegistration}>
            Anuluj zgłoszenie
          </button>
        )}
      </div>
      {open && (
        <ul className="border-t divide-y">
          {activeAttendees.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{a.firstName} {a.lastName}</span>
                <span className="ml-2 text-gray-500">{a.typeName}</span>
              </div>
              {hasMultiple && onRemoveAttendee && (
                <button type="button" className="text-xs text-red-600 underline"
                  onClick={() => onRemoveAttendee(a.id)}>
                  Usuń uczestnika
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/events/[id]/participants/AttendeeGroupRow.tsx
git commit -m "feat(dashboard): add attendee group row component"
```

---

### Task 6.2: Per-attendee removal server action

**Files:**
- Modify: `src/app/dashboard/events/[id]/actions.ts`

- [ ] **Step 1: Add the action**

Open `src/app/dashboard/events/[id]/actions.ts`. Add:

```ts
"use server";
import { softCancelAttendee, listActiveAttendeesForParticipant } from "@/lib/db/queries/attendees";
import { getParticipantById } from "@/lib/db/queries/participants";
// ... existing imports

export async function removeAttendeeAction(formData: FormData): Promise<{ error?: string }> {
  const attendeeId = String(formData.get("attendeeId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  if (!attendeeId || !participantId) return { error: "Brak danych." };

  // Verify caller owns the event (reuse existing auth helper — call same pattern as cancelParticipantAction).
  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Nie znaleziono uczestnika." };

  const active = await listActiveAttendeesForParticipant(participantId);
  if (active.length <= 1) return { error: "Nie można usunąć ostatniego uczestnika — anuluj całe zgłoszenie." };
  if (!active.some((a) => a.id === attendeeId)) return { error: "Uczestnik nie należy do tego zgłoszenia." };

  await softCancelAttendee(attendeeId, Date.now());
  return {};
}
```

If the file has an auth/ownership verification pattern used by `cancelParticipantAction` (or similar), replicate it before mutating. Search with:

Run: `grep -n "cancelParticipant\|getOrganizerByClerkId\|auth()" src/app/dashboard/events/[id]/actions.ts | head -20`

If there's a helper like `ensureOrganizerOwnsEvent(...)`, call it before `softCancelAttendee`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/events/[id]/actions.ts
git commit -m "feat(dashboard): add per-attendee removal action"
```

---

### Task 6.3: Remove-attendee confirmation dialog

**Files:**
- Create: `src/app/dashboard/events/[id]/participants/RemoveAttendeeDialog.tsx`

- [ ] **Step 1: Implement the dialog**

Create `src/app/dashboard/events/[id]/participants/RemoveAttendeeDialog.tsx`:

```tsx
"use client";
import type { Attendee } from "@/lib/db/schema";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { calculateTotal } from "@/lib/pricing";

type Props = {
  registrantName: string;
  attendeeToRemove: Attendee & { typeName: string };
  remainingAttendees: Array<Attendee & { typeName: string }>;
  attendeeTypes: AttendeeType[];
  paidCents: number;
  remainingCapacity: number;
  onConfirm: () => void;
  onCancel: () => void;
};

function formatPLN(cents: number) {
  return (cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł";
}

function quantitiesFrom(list: Array<Attendee>): Record<string, number> {
  const q: Record<string, number> = {};
  for (const a of list) q[a.attendeeTypeId] = (q[a.attendeeTypeId] ?? 0) + 1;
  return q;
}

export function RemoveAttendeeDialog({
  registrantName, attendeeToRemove, remainingAttendees, attendeeTypes,
  paidCents, remainingCapacity, onConfirm, onCancel,
}: Props) {
  const originalTotal = calculateTotal(
    attendeeTypes,
    quantitiesFrom([attendeeToRemove, ...remainingAttendees]),
  ).total;
  const newTotal = calculateTotal(attendeeTypes, quantitiesFrom(remainingAttendees)).total;
  const suggestedRefund = Math.max(0, Math.min(paidCents, originalTotal - newTotal));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-md max-w-md w-full p-6 space-y-3">
        <h2 className="font-semibold text-lg">
          Usunąć {attendeeToRemove.firstName} {attendeeToRemove.lastName} z zgłoszenia?
        </h2>
        <p className="text-sm">
          {attendeeToRemove.firstName} jest częścią zgłoszenia <strong>{registrantName}</strong>
          {" "}({remainingAttendees.length + 1} osoby łącznie). Po usunięciu:
        </p>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Zgłoszenie będzie zawierać {remainingAttendees.length} osób.</li>
          <li>Nowa cena: <strong>{formatPLN(newTotal)}</strong> (było {formatPLN(originalTotal)})</li>
          <li>Sugerowany zwrot: <strong>{formatPLN(suggestedRefund)}</strong></li>
          <li>Zwolni się 1 miejsce (pozostałych wolnych: {remainingCapacity + 1})</li>
        </ul>
        <p className="text-xs text-gray-600">
          Zwrot nie zostanie wykonany automatycznie — wykonasz go ręcznie po potwierdzeniu.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="px-3 py-1 border rounded" onClick={onCancel}>Anuluj</button>
          <button type="button" className="px-3 py-1 bg-red-600 text-white rounded" onClick={onConfirm}>
            Usuń uczestnika
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/events/[id]/participants/RemoveAttendeeDialog.tsx
git commit -m "feat(dashboard): add remove-attendee confirmation dialog"
```

---

### Task 6.4: Wire group rows into the participant list page

**Files:**
- Modify: `src/app/dashboard/events/[id]/page.tsx` (or the specific sub-page rendering the participant list — check which one does).

- [ ] **Step 1: Locate the participant-rendering file**

Run: `grep -rln "listParticipantsForEvent\|participants.map" src/app/dashboard/events/\[id\]/`
Open the result that renders the list.

- [ ] **Step 2: Fetch attendees for the event and group them**

In that page (server component), load attendees using `listAttendeesForEvent(eventId)`, parse `event.attendeeTypes` to resolve type names, and pass to the client:

```ts
import { listAttendeesForEvent } from "@/lib/db/queries/attendees";
// inside the component:
const attendees = await listAttendeesForEvent(event.id);
const attendeeTypes = event.attendeeTypes ? JSON.parse(event.attendeeTypes) : [];
const typeNameById = new Map<string, string>((attendeeTypes as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]));

// Build groups: participantId -> attendees[]
const groupByParticipant = new Map<string, Array<{ id: string; firstName: string; lastName: string; typeName: string; cancelledAt: number | null; attendeeTypeId: string }>>();
for (const a of attendees) {
  const list = groupByParticipant.get(a.participantId) ?? [];
  list.push({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    cancelledAt: a.cancelledAt,
    attendeeTypeId: a.attendeeTypeId,
    typeName: typeNameById.get(a.attendeeTypeId) ?? "Uczestnik",
  });
  groupByParticipant.set(a.participantId, list);
}
```

- [ ] **Step 3: Render `AttendeeGroupRow` per participant**

Replace each `<tr>`/`<li>` in the current participant rendering with a `<AttendeeGroupRow />`. Pass the registrant info + the group. Keep the legacy fallback: if `groupByParticipant.get(p.id)` is empty, synthesize a single-attendee group from the registrant's own firstName/lastName so the UI still renders for legacy events.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- Open an existing event's dashboard. Legacy participants should render as single-attendee rows (no "3 osób" badge, no expandable).
- Create a new multi-attendee registration (via the public form, or seed one manually). Confirm it shows expandable with per-attendee rows.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/events/[id]/page.tsx
git commit -m "feat(dashboard): render participants as attendee groups"
```

---

### Task 6.5: Hook removal dialog + action to the group row

**Files:**
- Modify: the parent client component that renders `AttendeeGroupRow` (likely a client wrapper around the page)

- [ ] **Step 1: Add dialog state**

In the client wrapper around `AttendeeGroupRow`, add:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Attendee } from "@/lib/db/schema";
import { AttendeeGroupRow } from "./AttendeeGroupRow";
import { RemoveAttendeeDialog } from "./RemoveAttendeeDialog";
import { removeAttendeeAction } from "../actions";

type AttendeeRow = Attendee & { typeName: string };

// inside component:
const router = useRouter();
const [removing, setRemoving] = useState<null | {
  registrantName: string;
  attendee: AttendeeRow;
  remaining: AttendeeRow[];
  paidCents: number;
}>(null);
```

- [ ] **Step 2: Trigger dialog from the row**

Pass an `onRemoveAttendee` handler that sets the `removing` state with all context needed for the dialog.

- [ ] **Step 3: On confirm, submit the server action**

```tsx
async function confirmRemove() {
  if (!removing) return;
  const fd = new FormData();
  fd.append("attendeeId", removing.attendee.id);
  fd.append("participantId", removing.attendee.participantId);
  const result = await removeAttendeeAction(fd);
  if (result.error) alert(result.error);
  setRemoving(null);
  router.refresh();
}
```

- [ ] **Step 4: Render the dialog conditionally**

```tsx
{removing && (
  <RemoveAttendeeDialog
    registrantName={removing.registrantName}
    attendeeToRemove={removing.attendee}
    remainingAttendees={removing.remaining}
    attendeeTypes={attendeeTypes}
    paidCents={removing.paidCents}
    remainingCapacity={remainingCapacity}
    onConfirm={confirmRemove}
    onCancel={() => setRemoving(null)}
  />
)}
```

- [ ] **Step 5: Manual test**

Run: `npm run dev`
- Register 1 parent + 2 children.
- In the dashboard, click "Usuń uczestnika" on one child. Confirm dialog shows suggested refund based on price calculation.
- Confirm. Row updates; capacity freed (check event header).

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/events/[id]/participants/
git commit -m "feat(dashboard): wire per-attendee removal dialog + action"
```

---

### Task 6.6: Group-aware cancel-registration warning

**Files:**
- Modify: the existing cancel-registration UI (wherever `cancelParticipantAction` or equivalent is invoked from the dashboard — find it with grep)

- [ ] **Step 1: Locate the cancel UI**

Run: `grep -rln "cancelParticipant\|Anuluj zgłoszenie" src/app/dashboard/`
Open the result that renders the cancel button/flow.

- [ ] **Step 2: Replace `confirm()` with a richer dialog**

If currently it uses a simple `window.confirm`, replace with a local dialog that lists the affected attendees and suggested refund — mirror `RemoveAttendeeDialog` but for the whole-registration case. The dialog body should follow the spec text exactly:

```
Anulować zgłoszenie <Imię Nazwisko>?

To usunie wszystkie N osób z wydarzenia:
- <imię 1> (<typ>)
- <imię 2> (<typ>)
...

Zwolni się N miejsc. Sugerowany zwrot: <X> zł.
```

Suggested refund = `min(paidCents, newTotal=0 → originalTotal)` — i.e., what they actually paid.

- [ ] **Step 3: Manual test**

Run: `npm run dev`
- Cancel a multi-attendee registration. Confirm the warning lists all attendees.
- Cancel a single-attendee (legacy) registration. Confirm the warning is a simpler single-person version (no list).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/
git commit -m "feat(dashboard): show affected attendees on registration cancel"
```

---

## Phase 7 — End-to-end verification

### Task 7.1: Full flow verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Apply the migration on a local D1**

Run: `npx wrangler d1 migrations apply <DB_NAME> --local`
(or equivalent per the project's migration tooling; check `package.json` scripts).

Expected: migration `0004_multi_attendee.sql` applied successfully.

- [ ] **Step 4: Smoke test — legacy event**

Create an event WITHOUT setting attendee types (direct DB insert with `attendee_types = NULL`, or create via the old path if still accessible). Register as a participant. Confirm the flow works end-to-end (form → Stripe checkout → succeed → capacity deducted by 1).

- [ ] **Step 5: Smoke test — Rodzic z dziećmi preset**

As an organizer:
1. Create a new event, pick "Rodzic z dziećmi" preset, set Rodzic = 200 PLN, Dziecko = 100 PLN, graduated "od 2-giego dziecka = 80 PLN." Capacity = 10. Save.
2. As a registrant, open /register. Add parent + 3 children (with ages + allergies where applicable).
3. Verify price summary shows 200 + 100 + 80 + 80 = 460 PLN.
4. Submit → Stripe checkout → pay → land on thanks page.
5. In dashboard, confirm the registration shows as an expandable group with 4 people.
6. Confirm capacity is 4/10.

- [ ] **Step 6: Smoke test — per-attendee removal**

From dashboard, remove one child. Dialog shows suggested refund (~80 PLN). Confirm. Group now shows 3 people; capacity 3/10.

- [ ] **Step 7: Smoke test — whole-registration cancel**

Cancel the whole registration. Dialog lists all 3 remaining attendees. Confirm. Capacity returns to 0/10.

- [ ] **Step 8: Commit verification notes (if any bugs found, fix and add commits)**

If everything passes, no commit needed. If fixes are made, commit them under appropriate messages.

---

## Spec coverage checklist

- [x] Data model — Phase 0 (Tasks 0.1, 0.2)
- [x] Pricing engine — Phase 1 (Tasks 1.1)
- [x] Presets — Phase 1 (Task 1.2)
- [x] Capacity — Phase 2 (Task 2.1)
- [x] Attendee queries — Phase 2 (Task 2.2)
- [x] Registration server flow — Phase 3 (Tasks 3.1, 3.2)
- [x] Registrant UX (form, cards, price summary) — Phase 4 (Tasks 4.1–4.3)
- [x] Organizer UX (presets, advanced editor, wiring) — Phase 5 (Tasks 5.1–5.3)
- [x] Dashboard group display — Phase 6 (Tasks 6.1, 6.4)
- [x] Per-attendee removal + refund suggestion + warnings — Phase 6 (Tasks 6.2, 6.3, 6.5)
- [x] Group-aware cancel warnings — Phase 6 (Task 6.6)
- [x] End-to-end verification — Phase 7 (Task 7.1)

# Event Creation Wizard + Unified Edit View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2-step "create then edit" event flow with a 10-step wizard at `/dashboard/events/new` (Step 7 hidden when free) plus a unified edit view at `/dashboard/events/[id]` with a section rail (desktop) / bottom-sheet (mobile). Resume support via `event.creationStep`. Two independent date+time pickers replace the buggy range picker. Per-attendee and per-registration questions consolidated into one place.

**Architecture:** Each wizard step has its own `?step=…` URL and its own server action that PATCHes the draft event row. Step components mirror the onboarding pattern: client component, props `{ value, onChange, error, onBack, onNext }`. The edit view re-uses those same per-section field clusters but composes them into a sticky-rail layout. State machine for `event.creationStep`: legacy `null` (existing rows) → step id while in wizard → `"complete"` once Step 10 is finished. The `"complete"` sentinel (vs. just `null`) is what distinguishes "post-wizard, awaiting first publish" from "pre-existing legacy row" — important because legacy drafts must NOT show the post-wizard banner.

**Tech Stack:** Next.js 16 App Router, React 19 (`useActionState`, `useTransition`), Drizzle ORM on Cloudflare D1, Zod, Tailwind v4, vitest, react-day-picker (single mode, not range).

**Spec:** [docs/superpowers/specs/2026-05-04-event-creation-wizard-design.md](../specs/2026-05-04-event-creation-wizard-design.md)

---

## Files to create / modify

**Create**

- `src/lib/db/migrations/0006_event_creation_step.sql` — adds two columns
- `src/lib/wizard/event-creation-steps.ts` — step ids, ordering, "is free?" logic
- `src/lib/wizard/event-creation-steps.test.ts`
- `src/lib/validators/event-wizard.ts` — per-step Zod slice schemas
- `src/lib/validators/event-wizard.test.ts`
- `src/components/dashboard/DateTimePickerField.tsx` — single date+time popover field (replaces range mode)
- `src/components/dashboard/EventDateTimeFields.tsx` — composes two `DateTimePickerField`s + duration hint (replaces `EventDateTimeRange`)
- `src/app/dashboard/events/new/wizard-actions.ts` — per-step server actions
- `src/app/dashboard/events/new/EventCreationWizard.tsx` — controller component
- `src/app/dashboard/events/new/steps/StepTitle.tsx` (10 step files total)
- `src/app/dashboard/events/new/steps/StepDescription.tsx`
- `src/app/dashboard/events/new/steps/StepDates.tsx`
- `src/app/dashboard/events/new/steps/StepLocation.tsx`
- `src/app/dashboard/events/new/steps/StepAttendees.tsx`
- `src/app/dashboard/events/new/steps/StepCapacity.tsx`
- `src/app/dashboard/events/new/steps/StepPayment.tsx`
- `src/app/dashboard/events/new/steps/StepPhotos.tsx`
- `src/app/dashboard/events/new/steps/StepQuestions.tsx`
- `src/app/dashboard/events/new/steps/StepConsents.tsx`
- `src/app/dashboard/events/[id]/EventEditView.tsx` — top-level edit view with rail/sheet
- `src/app/dashboard/events/[id]/SectionRail.tsx` — desktop sticky rail
- `src/app/dashboard/events/[id]/SectionSheet.tsx` — mobile bottom sheet
- `src/app/dashboard/events/[id]/sections/SectionBasics.tsx` (10 section files matching the rail entries)
- `src/app/dashboard/events/[id]/sections/SectionDates.tsx`
- `src/app/dashboard/events/[id]/sections/SectionLocation.tsx`
- `src/app/dashboard/events/[id]/sections/SectionAttendees.tsx`
- `src/app/dashboard/events/[id]/sections/SectionCapacity.tsx`
- `src/app/dashboard/events/[id]/sections/SectionPayment.tsx`
- `src/app/dashboard/events/[id]/sections/SectionPhotos.tsx`
- `src/app/dashboard/events/[id]/sections/SectionQuestions.tsx`
- `src/app/dashboard/events/[id]/sections/SectionConsents.tsx`
- `src/app/dashboard/events/[id]/section-status.ts` — pure function: row → `Record<sectionId, 'filled' | 'empty'>`
- `src/app/dashboard/events/[id]/section-status.test.ts`
- `src/app/dashboard/events/[id]/section-actions.ts` — per-section server actions

**Modify**

- `src/lib/db/schema.ts:31-61` — add `creationStep` and `publishedAt` columns to `events` table
- `src/lib/attendee-presets.ts:56-69` — replace `PRESET_LABELS` copy
- `src/lib/db/queries/events-dashboard.ts` — add `setCreationStep`, `markPublished`, `dashboard list query` returning the new fields
- `src/app/dashboard/events/new/page.tsx` — replace `<NewEventForm>` with `<EventCreationWizard>`
- `src/app/dashboard/events/[id]/page.tsx` — replace `<EventEditForm>` with `<EventEditView>` for the edit tab; remove publish/unpublish/archive buttons from the header (they move into the rail)
- `src/app/dashboard/events/[id]/actions.ts:?` — keep `changeStatusAction`; add `publishEventAction` that wraps it and sets `publishedAt` on first publish
- `src/components/dashboard/DashboardEventCard.tsx` — add "Dokończ tworzenie" CTA when `event.creationStep` is a non-`"complete"` step id

**Delete**

- `src/app/dashboard/events/new/NewEventForm.tsx`
- `src/app/dashboard/events/new/actions.ts` (replaced by `wizard-actions.ts`)
- `src/app/dashboard/events/[id]/EventEditForm.tsx`
- `src/components/dashboard/EventDateTimeRange.tsx`
- `src/app/dashboard/events/[id]/AttendeeCustomFieldsEditor.tsx` — its callers move into `SectionQuestions.tsx` / `StepQuestions.tsx`. Re-evaluate during Task 11 — if still used elsewhere, keep it.

---

## Task 1: DB migration + Drizzle schema

**Files:**
- Create: `src/lib/db/migrations/0006_event_creation_step.sql`
- Modify: `src/lib/db/schema.ts:31-61`

- [ ] **Step 1: Write the migration**

Create `src/lib/db/migrations/0006_event_creation_step.sql`:

```sql
-- 0006_event_creation_step.sql
-- Adds wizard-resume tracking and first-publish timestamp.
-- creation_step: NULL = legacy row (pre-wizard) OR pre-existing event;
--                step id (e.g. 'opis', 'termin') = wizard in progress, resume here;
--                'complete' = wizard finished, awaiting first publish (or already published).
-- published_at: NULL until first publish; set once and never reset.

ALTER TABLE `events` ADD COLUMN `creation_step` text;
--> statement-breakpoint
ALTER TABLE `events` ADD COLUMN `published_at` integer;
--> statement-breakpoint
-- Backfill published_at for pre-existing published rows (per spec).
UPDATE `events` SET `published_at` = `updated_at` WHERE `status` = 'published';
```

Per the spec, legacy rows keep `creation_step = NULL`. The post-wizard banner uses `creation_step === 'complete'` as its trigger (not `NULL`), so legacy drafts correctly do not get the banner. The backfill of `published_at` for already-published rows keeps the field's invariant ("set once on first publish, never reset") historically consistent.

- [ ] **Step 2: Update Drizzle schema**

In `src/lib/db/schema.ts`, replace the `events` table definition (lines 31-61) by adding the two new columns *after* `updatedAt`:

```ts
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
    attendeeTypes: text("attendee_types"),
    depositCents: integer("deposit_cents"),
    balanceDueAt: integer("balance_due_at"),
    consentConfig: text("consent_config"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    creationStep: text("creation_step"),
    publishedAt: integer("published_at"),
  },
  (t) => ({
    organizerIdx: index("events_organizer_idx").on(t.organizerId),
    organizerSlugUniq: uniqueIndex("events_organizer_slug_uniq").on(t.organizerId, t.slug),
  }),
);
```

- [ ] **Step 3: Apply the migration locally**

Run: `npm run db:migrate:local`
Expected: migration `0006_event_creation_step.sql` applied with no errors.

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors. Both new columns appear on `typeof schema.events.$inferSelect`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/migrations/0006_event_creation_step.sql src/lib/db/schema.ts
git commit -m "feat(db): add events.creation_step + events.published_at"
```

---

## Task 2: Step ordering utilities (TDD)

**Files:**
- Create: `src/lib/wizard/event-creation-steps.ts`
- Test: `src/lib/wizard/event-creation-steps.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/wizard/event-creation-steps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ALL_STEP_IDS,
  STEP_LABELS,
  isFreeFromAttendeeTypes,
  visibleStepsFor,
  nextStepId,
  prevStepId,
  isStepIdValid,
  type StepId,
} from "./event-creation-steps";
import type { AttendeeType } from "@/lib/validators/attendee-types";

const paid: AttendeeType[] = [
  { id: "a1", name: "Uczestnik", priceCents: 5000, minQty: 1, maxQty: 1 },
];
const free: AttendeeType[] = [
  { id: "a1", name: "Uczestnik", priceCents: 0, minQty: 1, maxQty: 1 },
];
const mixedFree: AttendeeType[] = [
  { id: "a1", name: "Rodzic", priceCents: 0, minQty: 1, maxQty: 1 },
  { id: "a2", name: "Dziecko", priceCents: 0, minQty: 0, maxQty: 4 },
];

describe("ALL_STEP_IDS", () => {
  it("has 10 ids in canonical order", () => {
    expect(ALL_STEP_IDS).toEqual([
      "tytul",
      "opis",
      "termin",
      "miejsce",
      "uczestnicy",
      "miejsca",
      "platnosc",
      "zdjecia",
      "pytania",
      "zgody",
    ]);
  });
});

describe("isFreeFromAttendeeTypes", () => {
  it("treats null/empty as free", () => {
    expect(isFreeFromAttendeeTypes(null)).toBe(true);
    expect(isFreeFromAttendeeTypes([])).toBe(true);
  });
  it("returns true when every type has priceCents 0", () => {
    expect(isFreeFromAttendeeTypes(free)).toBe(true);
    expect(isFreeFromAttendeeTypes(mixedFree)).toBe(true);
  });
  it("returns false when any type has priceCents > 0", () => {
    expect(isFreeFromAttendeeTypes(paid)).toBe(false);
  });
});

describe("visibleStepsFor", () => {
  it("returns all 10 steps for paid events", () => {
    expect(visibleStepsFor(paid)).toHaveLength(10);
    expect(visibleStepsFor(paid)).toContain("platnosc");
  });
  it("omits 'platnosc' for free events", () => {
    const visible = visibleStepsFor(free);
    expect(visible).toHaveLength(9);
    expect(visible).not.toContain("platnosc");
  });
});

describe("nextStepId", () => {
  it("returns next visible step", () => {
    expect(nextStepId("tytul", paid)).toBe("opis");
    expect(nextStepId("miejsca", paid)).toBe("platnosc");
    expect(nextStepId("miejsca", free)).toBe("zdjecia"); // skips platnosc
  });
  it("returns null after the last step", () => {
    expect(nextStepId("zgody", paid)).toBeNull();
    expect(nextStepId("zgody", free)).toBeNull();
  });
});

describe("prevStepId", () => {
  it("returns previous visible step", () => {
    expect(prevStepId("opis", paid)).toBe("tytul");
    expect(prevStepId("zdjecia", paid)).toBe("platnosc");
    expect(prevStepId("zdjecia", free)).toBe("miejsca"); // skips platnosc
  });
  it("returns null before the first step", () => {
    expect(prevStepId("tytul", paid)).toBeNull();
  });
});

describe("isStepIdValid", () => {
  it("returns true for canonical ids", () => {
    expect(isStepIdValid("tytul")).toBe(true);
    expect(isStepIdValid("zgody")).toBe(true);
  });
  it("returns false for unknown strings", () => {
    expect(isStepIdValid("xxx")).toBe(false);
    expect(isStepIdValid("")).toBe(false);
    expect(isStepIdValid(null)).toBe(false);
  });
  it("returns false for the 'complete' sentinel (which is not a step)", () => {
    expect(isStepIdValid("complete")).toBe(false);
  });
});

describe("STEP_LABELS", () => {
  it("provides a Polish label for each step id", () => {
    for (const id of ALL_STEP_IDS) {
      expect(STEP_LABELS[id as StepId]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- event-creation-steps`
Expected: FAIL — "Cannot find module './event-creation-steps'".

- [ ] **Step 3: Implement the module**

Create `src/lib/wizard/event-creation-steps.ts`:

```ts
import type { AttendeeType } from "@/lib/validators/attendee-types";

export const ALL_STEP_IDS = [
  "tytul",
  "opis",
  "termin",
  "miejsce",
  "uczestnicy",
  "miejsca",
  "platnosc",
  "zdjecia",
  "pytania",
  "zgody",
] as const;
export type StepId = (typeof ALL_STEP_IDS)[number];

export const STEP_LABELS: Record<StepId, string> = {
  tytul: "Tytuł",
  opis: "Opis",
  termin: "Termin",
  miejsce: "Miejsce",
  uczestnicy: "Uczestnicy",
  miejsca: "Liczba miejsc",
  platnosc: "Płatność",
  zdjecia: "Zdjęcia",
  pytania: "Pytania",
  zgody: "Zgody",
};

export function isFreeFromAttendeeTypes(types: AttendeeType[] | null): boolean {
  if (!types || types.length === 0) return true;
  return types.every((t) => t.priceCents === 0);
}

export function visibleStepsFor(types: AttendeeType[] | null): StepId[] {
  const free = isFreeFromAttendeeTypes(types);
  return ALL_STEP_IDS.filter((id) => !(free && id === "platnosc"));
}

export function nextStepId(current: StepId, types: AttendeeType[] | null): StepId | null {
  const visible = visibleStepsFor(types);
  const idx = visible.indexOf(current);
  if (idx === -1 || idx >= visible.length - 1) return null;
  return visible[idx + 1];
}

export function prevStepId(current: StepId, types: AttendeeType[] | null): StepId | null {
  const visible = visibleStepsFor(types);
  const idx = visible.indexOf(current);
  if (idx <= 0) return null;
  return visible[idx - 1];
}

export function isStepIdValid(id: unknown): id is StepId {
  return typeof id === "string" && (ALL_STEP_IDS as readonly string[]).includes(id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- event-creation-steps`
Expected: PASS — all groups green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wizard/
git commit -m "feat(wizard): add event-creation step ordering utilities"
```

---

## Task 3: Per-step validator slices (TDD)

**Files:**
- Create: `src/lib/validators/event-wizard.ts`
- Test: `src/lib/validators/event-wizard.test.ts`

The full event schema in `src/lib/validators/event.ts` validates a complete event for publish. Each wizard step needs to validate only its slice — required-to-advance fields enforced strictly, optional fields validated only if non-empty.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/validators/event-wizard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  stepTitleSchema,
  stepDatesSchema,
  stepCapacitySchema,
  stepPaymentSchema,
} from "./event-wizard";

describe("stepTitleSchema", () => {
  it("requires a title", () => {
    const r = stepTitleSchema.safeParse({ title: "" });
    expect(r.success).toBe(false);
  });
  it("accepts a slug-like string", () => {
    const r = stepTitleSchema.safeParse({ title: "Spotkanie", slug: "spotkanie" });
    expect(r.success).toBe(true);
  });
  it("rejects an invalid slug pattern", () => {
    const r = stepTitleSchema.safeParse({ title: "Spotkanie", slug: "Bad Slug" });
    expect(r.success).toBe(false);
  });
});

describe("stepDatesSchema", () => {
  it("requires endsAt > startsAt", () => {
    const r = stepDatesSchema.safeParse({ startsAt: 200, endsAt: 100 });
    expect(r.success).toBe(false);
  });
  it("accepts a valid range", () => {
    const r = stepDatesSchema.safeParse({ startsAt: 100, endsAt: 200 });
    expect(r.success).toBe(true);
  });
});

describe("stepCapacitySchema", () => {
  it("requires capacity >= 1", () => {
    expect(stepCapacitySchema.safeParse({ capacity: 0 }).success).toBe(false);
    expect(stepCapacitySchema.safeParse({ capacity: 1 }).success).toBe(true);
  });
});

describe("stepPaymentSchema", () => {
  it("accepts no deposit (depositOn === false)", () => {
    const r = stepPaymentSchema.safeParse({ depositOn: false });
    expect(r.success).toBe(true);
  });
  it("requires deposit + balanceDueAt when depositOn", () => {
    const r = stepPaymentSchema.safeParse({ depositOn: true });
    expect(r.success).toBe(false);
  });
  it("accepts depositOn with valid deposit + balance", () => {
    const r = stepPaymentSchema.safeParse({
      depositOn: true,
      depositCents: 5000,
      balanceDueAt: 1_700_000_000_000,
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- event-wizard`
Expected: FAIL — "Cannot find module './event-wizard'".

- [ ] **Step 3: Implement the slice schemas**

Create `src/lib/validators/event-wizard.ts`:

```ts
import { z } from "zod";

export const stepTitleSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Dozwolone małe litery, cyfry i myślniki"),
});

export const stepDescriptionSchema = z.object({
  description: z.string().max(10_000).optional(),
});

export const stepDatesSchema = z
  .object({
    startsAt: z.number().int().positive(),
    endsAt: z.number().int().positive(),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: "Koniec wydarzenia musi być po jego początku.",
    path: ["endsAt"],
  });

export const stepLocationSchema = z.object({
  location: z.string().max(200).optional(),
});

// step "uczestnicy" reuses attendeeTypesSchema directly — see actions

export const stepCapacitySchema = z.object({
  capacity: z.number().int().min(1).max(10_000),
});

export const stepPaymentSchema = z
  .object({
    depositOn: z.boolean(),
    depositCents: z.coerce.number().int().nonnegative().nullable().optional(),
    balanceDueAt: z.coerce.number().int().positive().nullable().optional(),
  })
  .refine(
    (d) =>
      !d.depositOn ||
      (d.depositCents != null && d.depositCents > 0 && d.balanceDueAt != null),
    {
      message: "Podaj zaliczkę i termin dopłaty.",
      path: ["depositCents"],
    },
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- event-wizard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/event-wizard.ts src/lib/validators/event-wizard.test.ts
git commit -m "feat(validators): add per-step Zod slice schemas for event wizard"
```

---

## Task 4: Update preset labels (with regression test)

**Files:**
- Modify: `src/lib/attendee-presets.ts:56-69`
- Test: `src/lib/attendee-presets.test.ts` (existing — extend it)

- [ ] **Step 1: Read the current test file**

Run: `cat src/lib/attendee-presets.test.ts | tail -20`

Note its style. Add new tests that lock in the new copy.

- [ ] **Step 2: Append regression tests**

Append to `src/lib/attendee-presets.test.ts`:

```ts
import { PRESET_LABELS } from "./attendee-presets";

describe("PRESET_LABELS (rewritten copy)", () => {
  it("uses 'Tylko siebie' for jedna_osoba", () => {
    expect(PRESET_LABELS.jedna_osoba.title).toBe("Tylko siebie");
    expect(PRESET_LABELS.jedna_osoba.description).toContain("tylko siebie");
  });

  it("keeps 'Rodzic z dziećmi' for rodzic_z_dziecmi", () => {
    expect(PRESET_LABELS.rodzic_z_dziecmi.title).toBe("Rodzic z dziećmi");
    expect(PRESET_LABELS.rodzic_z_dziecmi.description).toContain("dzieci");
  });

  it("uses 'Grupa (kilka osób na raz)' for grupa", () => {
    expect(PRESET_LABELS.grupa.title).toBe("Grupa (kilka osób na raz)");
    expect(PRESET_LABELS.grupa.description).toContain("siebie i znajomych");
  });
});
```

(If the file doesn't already import `PRESET_LABELS`, the new import statement may need to be merged with an existing one — check the file first.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- attendee-presets`
Expected: FAIL on the three new tests (current copy is different).

- [ ] **Step 4: Update PRESET_LABELS**

In `src/lib/attendee-presets.ts`, replace lines 56-69:

```ts
export const PRESET_LABELS: Record<PresetId, { title: string; description: string }> = {
  jedna_osoba: {
    title: "Tylko siebie",
    description:
      "Każda osoba zapisuje tylko siebie. Jedno zgłoszenie = jedna osoba. Najprostsze.",
  },
  rodzic_z_dziecmi: {
    title: "Rodzic z dziećmi",
    description:
      "Rodzic zapisuje siebie i swoje dzieci w jednym zgłoszeniu. Możesz mieć inną cenę dla dziecka i pytać o każde dziecko osobno (wiek, alergie).",
  },
  grupa: {
    title: "Grupa (kilka osób na raz)",
    description:
      "Jedna osoba zapisuje siebie i znajomych w jednym zgłoszeniu — np. razem z koleżanką albo całym zespołem. Ty ustalasz, ile osób maksymalnie może być w jednym zgłoszeniu.",
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- attendee-presets`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/attendee-presets.ts src/lib/attendee-presets.test.ts
git commit -m "feat(presets): rewrite preset labels for clarity (Tylko siebie / Grupa)"
```

---

## Task 5: `DateTimePickerField` component (single popover)

**Files:**
- Create: `src/components/dashboard/DateTimePickerField.tsx`

This is a single-purpose date+time picker: one labeled input ("Początek" or "Koniec"), one popover calendar (`react-day-picker` in single mode, not range), one `<TimePickerSelects>`, paired hidden input for FormData.

- [ ] **Step 1: Create the component**

Create `src/components/dashboard/DateTimePickerField.tsx`:

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import { TimePickerSelects } from "./TimePickerSelects";
import {
  combineLocalDateAndTime,
  formatDdMmYyyyFromDate,
  formatDdMmYyyyInput,
  parseDdMmYyyy,
  startOfLocalDay,
  timestampToDdMmYyyyAndTime,
} from "@/lib/datetime-form";

import "react-day-picker/style.css";

type Props = {
  /** Hidden form field name carrying the combined "YYYY-MM-DDTHH:mm" value. */
  name: string;
  label: string;
  defaultValue?: number; // unix ms
  defaultTime?: string; // "HH:mm"
  required?: boolean;
  onChange?: (msOrNull: number | null) => void;
};

export function DateTimePickerField({
  name,
  label,
  defaultValue,
  defaultTime = "09:00",
  required,
  onChange,
}: Props) {
  const id = useId();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState<Date | undefined>(() =>
    defaultValue != null ? startOfLocalDay(defaultValue) : undefined,
  );
  const [dateStr, setDateStr] = useState(() =>
    defaultValue != null ? formatDdMmYyyyFromDate(startOfLocalDay(defaultValue)) : "",
  );
  const [timeStr, setTimeStr] = useState(() =>
    defaultValue != null ? timestampToDdMmYyyyAndTime(defaultValue).time : defaultTime,
  );
  const [open, setOpen] = useState(false);

  const combined = !date ? "" : combineLocalDateAndTime(date, timeStr) ?? "";

  useEffect(() => {
    if (!onChange) return;
    if (!combined) {
      onChange(null);
      return;
    }
    const t = new Date(combined).getTime();
    onChange(Number.isNaN(t) ? null : t);
  }, [combined, onChange]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleManualBlur() {
    const parts = parseDdMmYyyy(dateStr.trim());
    if (!parts) {
      setDate(undefined);
      return;
    }
    setDate(new Date(parts.y, parts.m - 1, parts.d));
  }

  function handlePick(d: Date | undefined) {
    setDate(d);
    setDateStr(d ? formatDdMmYyyyFromDate(d) : "");
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-border bg-white/60 p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-2 flex items-end gap-2">
        <label className="relative flex-1">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/rrrr"
            value={dateStr}
            onChange={(e) => setDateStr(formatDdMmYyyyInput(e.target.value))}
            onFocus={() => setOpen(true)}
            onBlur={handleManualBlur}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={label}
            aria-controls={`${id}-cal`}
            aria-expanded={open}
            required={required}
          />
          {open && (
            <div
              ref={popoverRef}
              id={`${id}-cal`}
              className="absolute left-0 top-full z-30 mt-1 rounded-xl border border-border bg-background p-2 shadow-lg"
            >
              <DayPicker
                mode="single"
                locale={pl}
                weekStartsOn={1}
                numberOfMonths={1}
                selected={date}
                onSelect={handlePick}
                className="[--rdp-accent-color:var(--primary)]"
              />
            </div>
          )}
        </label>
        <TimePickerSelects idPrefix={`${id}-time`} timeStr={timeStr} setTimeStr={setTimeStr} />
      </div>
      {date && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {format(date, "EEE d MMM", { locale: pl })} · {timeStr}
        </p>
      )}
      <input type="hidden" name={name} value={combined} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DateTimePickerField.tsx
git commit -m "feat(dashboard): single-popover DateTimePickerField (no range mode)"
```

---

## Task 6: `EventDateTimeFields` (replaces `EventDateTimeRange`)

**Files:**
- Create: `src/components/dashboard/EventDateTimeFields.tsx`
- Delete (later, in Task 17): `src/components/dashboard/EventDateTimeRange.tsx`

- [ ] **Step 1: Create the wrapper**

Create `src/components/dashboard/EventDateTimeFields.tsx`:

```tsx
"use client";

import { useState } from "react";
import { DateTimePickerField } from "./DateTimePickerField";

type Props = {
  defaultStartsAt?: number;
  defaultEndsAt?: number;
  /** Server-side validation message (e.g. range order). */
  error?: string;
};

export function EventDateTimeFields({ defaultStartsAt, defaultEndsAt, error }: Props) {
  const [starts, setStarts] = useState<number | null>(defaultStartsAt ?? null);
  const [ends, setEnds] = useState<number | null>(defaultEndsAt ?? null);

  const durationHint =
    starts != null && ends != null && ends > starts ? formatDurationMs(ends - starts) : null;

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Termin wydarzenia</legend>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <DateTimePickerField
            name="startsAt"
            label="Początek"
            defaultValue={defaultStartsAt}
            defaultTime="09:00"
            required
            onChange={setStarts}
          />
        </div>
        <div className="flex-1">
          <DateTimePickerField
            name="endsAt"
            label="Koniec"
            defaultValue={defaultEndsAt}
            defaultTime="17:00"
            required
            onChange={setEnds}
          />
        </div>
      </div>
      {durationHint && (
        <p className="text-sm text-muted-foreground">Czas trwania: {durationHint}</p>
      )}
    </fieldset>
  );
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  const mins = totalMin - days * 60 * 24 - hours * 60;
  const parts: string[] = [];
  if (days > 0) parts.push(days === 1 ? "1 dzień" : `${days} dni`);
  if (hours > 0) parts.push(hours === 1 ? "1 godz." : `${hours} godz.`);
  if (mins > 0 && days === 0) parts.push(`${mins} min`);
  return parts.length === 0 ? "0 min" : parts.join(" ");
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/EventDateTimeFields.tsx
git commit -m "feat(dashboard): EventDateTimeFields composing two single pickers"
```

---

## Task 7: Per-step server actions

**Files:**
- Create: `src/app/dashboard/events/new/wizard-actions.ts`
- Modify: `src/lib/db/queries/events-dashboard.ts` (add helpers)

- [ ] **Step 1: Add query helpers**

Append to `src/lib/db/queries/events-dashboard.ts`:

```ts
export async function getDraftForOrganizerById(
  organizerId: string,
  eventId: string,
) {
  return getEventForOrganizer(organizerId, eventId);
}

export async function setCreationStep(
  organizerId: string,
  eventId: string,
  step: string | null,
) {
  await updateEvent(organizerId, eventId, { creationStep: step });
}

export async function markPublishedFirstTimeIfNeeded(
  organizerId: string,
  eventId: string,
) {
  const ev = await getEventForOrganizer(organizerId, eventId);
  if (!ev || ev.publishedAt != null) return;
  await updateEvent(organizerId, eventId, { publishedAt: Date.now() });
}
```

- [ ] **Step 2: Create the per-step actions**

Create `src/app/dashboard/events/new/wizard-actions.ts`:

```ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { newId } from "@/lib/ids";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import {
  getEventForOrganizer,
  insertEvent,
  isSlugTakenForOrganizer,
  setCreationStep,
  updateEvent,
} from "@/lib/db/queries/events-dashboard";
import {
  insertEventPhotos,
  listPhotosForEvent,
  replacePhotosForEvent,
} from "@/lib/db/queries/event-photos";
import {
  stepTitleSchema,
  stepDescriptionSchema,
  stepDatesSchema,
  stepLocationSchema,
  stepCapacitySchema,
  stepPaymentSchema,
} from "@/lib/validators/event-wizard";
import {
  attendeeTypesSchema,
  type AttendeeType,
} from "@/lib/validators/attendee-types";
import { customQuestionSchema } from "@/lib/validators/event";
import { consentConfigSchema } from "@/lib/validators/consent";
import { z } from "zod";
import { nextStepId, type StepId } from "@/lib/wizard/event-creation-steps";

export type StepResult =
  | { ok: true; eventId: string; nextStep: StepId | "complete" }
  | { errors: Record<string, string>; values: Record<string, string> };

async function requireOrganizer() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  return organizer;
}

async function requireOwnedDraft(organizerId: string, eventId: string) {
  const ev = await getEventForOrganizer(organizerId, eventId);
  if (!ev) throw new Error("Not found");
  if (ev.status === "published" || ev.status === "archived") {
    throw new Error("Event no longer in wizard");
  }
  return ev;
}

function loadAttendeeTypes(json: string | null): AttendeeType[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as AttendeeType[]) : null;
  } catch {
    return null;
  }
}

function pricesFromTypes(types: AttendeeType[] | null): number {
  if (!types || types.length === 0) return 0;
  return types.reduce((m, t) => Math.max(m, t.priceCents), 0);
}

// ---------- Step 1: Title (creates the row on first call) ----------

export async function saveStepTitleAction(
  eventId: string | null,
  formData: FormData,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const parsed = stepTitleSchema.safeParse({ title, slug });
  if (!parsed.success) {
    return {
      errors: zodIssues(parsed.error.issues),
      values: { title, slug },
    };
  }

  if (eventId == null) {
    if (await isSlugTakenForOrganizer(organizer.id, parsed.data.slug)) {
      return {
        errors: { slug: "Ta nazwa w URL jest już zajęta" },
        values: { title, slug },
      };
    }
    const id = newId();
    const now = Date.now();
    await insertEvent({
      id,
      organizerId: organizer.id,
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: null,
      location: null,
      startsAt: 0,
      endsAt: 0,
      priceCents: 0,
      currency: "PLN",
      capacity: 1,
      coverUrl: null,
      status: "draft",
      customQuestions: JSON.stringify([]),
      attendeeTypes: null,
      depositCents: null,
      balanceDueAt: null,
      consentConfig: null,
      createdAt: now,
      updatedAt: now,
      creationStep: "opis",
      publishedAt: null,
    });
    return { ok: true, eventId: id, nextStep: "opis" };
  }

  const ev = await requireOwnedDraft(organizer.id, eventId);
  // Re-check slug uniqueness only if slug changed
  if (parsed.data.slug !== ev.slug) {
    if (await isSlugTakenForOrganizer(organizer.id, parsed.data.slug)) {
      return {
        errors: { slug: "Ta nazwa w URL jest już zajęta" },
        values: { title, slug },
      };
    }
  }
  await updateEvent(organizer.id, eventId, {
    title: parsed.data.title,
    slug: parsed.data.slug,
    creationStep: nextStepId("tytul", loadAttendeeTypes(ev.attendeeTypes)) ?? "opis",
  });
  return { ok: true, eventId, nextStep: "opis" };
}

// ---------- Step 2: Description ----------

export async function saveStepDescriptionAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const description = String(formData.get("description") ?? "");
  if (!skip) {
    const parsed = stepDescriptionSchema.safeParse({ description });
    if (!parsed.success) {
      return {
        errors: zodIssues(parsed.error.issues),
        values: { description },
      };
    }
  }
  const next = nextStepId("opis", loadAttendeeTypes(ev.attendeeTypes)) ?? "termin";
  await updateEvent(organizer.id, eventId, {
    description: skip ? ev.description : description.trim() || null,
    creationStep: next,
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 3: Dates ----------

export async function saveStepDatesAction(
  eventId: string,
  formData: FormData,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const startsRaw = String(formData.get("startsAt") ?? "");
  const endsRaw = String(formData.get("endsAt") ?? "");
  const startsAt = startsRaw ? new Date(startsRaw).getTime() : NaN;
  const endsAt = endsRaw ? new Date(endsRaw).getTime() : NaN;
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return {
      errors: { startsAt: "Wybierz początek i koniec.", endsAt: "Wybierz początek i koniec." },
      values: { startsAt: startsRaw, endsAt: endsRaw },
    };
  }
  const parsed = stepDatesSchema.safeParse({ startsAt, endsAt });
  if (!parsed.success) {
    return {
      errors: zodIssues(parsed.error.issues),
      values: { startsAt: startsRaw, endsAt: endsRaw },
    };
  }
  const next = nextStepId("termin", loadAttendeeTypes(ev.attendeeTypes)) ?? "miejsce";
  await updateEvent(organizer.id, eventId, {
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    creationStep: next,
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 4: Location ----------

export async function saveStepLocationAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const location = String(formData.get("location") ?? "");
  if (!skip) {
    const parsed = stepLocationSchema.safeParse({ location });
    if (!parsed.success) {
      return {
        errors: zodIssues(parsed.error.issues),
        values: { location },
      };
    }
  }
  const next = nextStepId("miejsce", loadAttendeeTypes(ev.attendeeTypes)) ?? "uczestnicy";
  await updateEvent(organizer.id, eventId, {
    location: skip ? ev.location : location.trim() || null,
    creationStep: next,
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 5: Attendees + per-type prices ----------

export async function saveStepAttendeesAction(
  eventId: string,
  formData: FormData,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  await requireOwnedDraft(organizer.id, eventId);
  const raw = String(formData.get("attendeeTypes") ?? "");
  if (!raw.trim()) {
    return {
      errors: { attendeeTypes: "Wybierz szablon i ustaw cenę." },
      values: { attendeeTypes: raw },
    };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return {
      errors: { attendeeTypes: "Niepoprawna konfiguracja typów uczestników." },
      values: { attendeeTypes: raw },
    };
  }
  const parsed = attendeeTypesSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      errors: { attendeeTypes: "Niepoprawna konfiguracja typów uczestników." },
      values: { attendeeTypes: raw },
    };
  }
  const types = parsed.data as AttendeeType[];
  const priceCents = pricesFromTypes(types);
  const next = nextStepId("uczestnicy", types) ?? "miejsca";
  await updateEvent(organizer.id, eventId, {
    attendeeTypes: JSON.stringify(types),
    priceCents,
    creationStep: next,
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 6: Capacity ----------

export async function saveStepCapacityAction(
  eventId: string,
  formData: FormData,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const capacityRaw = String(formData.get("capacity") ?? "");
  const capacity = Number(capacityRaw);
  const parsed = stepCapacitySchema.safeParse({ capacity });
  if (!parsed.success) {
    return {
      errors: zodIssues(parsed.error.issues),
      values: { capacity: capacityRaw },
    };
  }
  const types = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("miejsca", types) ?? "platnosc";
  await updateEvent(organizer.id, eventId, {
    capacity: parsed.data.capacity,
    creationStep: next,
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 7: Payment ----------

export async function saveStepPaymentAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const types = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("platnosc", types) ?? "zdjecia";

  if (skip) {
    await updateEvent(organizer.id, eventId, {
      depositCents: null,
      balanceDueAt: null,
      creationStep: next,
    });
    return { ok: true, eventId, nextStep: next };
  }

  const depositOn = formData.get("depositOn") === "on" || formData.get("depositOn") === "true";
  const depositRaw = String(formData.get("deposit") ?? "");
  const balanceDueRaw = String(formData.get("balanceDueAt") ?? "");
  const depositCents = depositRaw ? Math.round(Number(depositRaw) * 100) : null;
  const balanceDueAt = balanceDueRaw ? new Date(balanceDueRaw).getTime() : null;

  const parsed = stepPaymentSchema.safeParse({ depositOn, depositCents, balanceDueAt });
  if (!parsed.success) {
    return {
      errors: zodIssues(parsed.error.issues),
      values: { deposit: depositRaw, balanceDueAt: balanceDueRaw, depositOn: depositOn ? "true" : "" },
    };
  }
  await updateEvent(organizer.id, eventId, {
    depositCents: depositOn ? depositCents : null,
    balanceDueAt: depositOn ? balanceDueAt : null,
    creationStep: next,
  });
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 8: Photos (cover + gallery) ----------

export async function saveStepPhotosAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const types = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("zdjecia", types) ?? "pytania";
  if (skip) {
    await updateEvent(organizer.id, eventId, { creationStep: next });
    return { ok: true, eventId, nextStep: next };
  }
  const coverUrl = String(formData.get("coverUrl") ?? "");
  const galleryRaw = String(formData.get("galleryPhotos") ?? "[]");
  let gallery: { url: string; position: number }[] = [];
  try {
    const arr = JSON.parse(galleryRaw);
    if (Array.isArray(arr)) {
      gallery = arr
        .filter(
          (p: unknown): p is { url: string; position: number } =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as Record<string, unknown>).url === "string" &&
            ((p as Record<string, unknown>).url as string).startsWith("/api/images/") &&
            typeof (p as Record<string, unknown>).position === "number" &&
            Number.isInteger((p as Record<string, unknown>).position) &&
            ((p as Record<string, unknown>).position as number) >= 0,
        )
        .slice(0, 5);
    }
  } catch {
    /* ignore */
  }
  await updateEvent(organizer.id, eventId, {
    coverUrl: coverUrl || null,
    creationStep: next,
  });
  await replacePhotosForEvent(eventId, gallery);
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 9: Questions (per-attendee + per-registration) ----------

const customQuestionsArraySchema = z.array(customQuestionSchema).max(20);

export async function saveStepQuestionsAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  const ev = await requireOwnedDraft(organizer.id, eventId);
  const types = loadAttendeeTypes(ev.attendeeTypes);
  const next = nextStepId("pytania", types) ?? "zgody";

  if (skip) {
    await updateEvent(organizer.id, eventId, { creationStep: next });
    return { ok: true, eventId, nextStep: next };
  }

  // Per-registration questions
  const regRaw = String(formData.get("customQuestions") ?? "[]");
  let regQuestions: unknown;
  try {
    regQuestions = JSON.parse(regRaw);
  } catch {
    return {
      errors: { customQuestions: "Niepoprawna konfiguracja pytań." },
      values: { customQuestions: regRaw },
    };
  }
  const regParsed = customQuestionsArraySchema.safeParse(regQuestions);
  if (!regParsed.success) {
    return {
      errors: { customQuestions: "Niepoprawna konfiguracja pytań." },
      values: { customQuestions: regRaw },
    };
  }

  // Per-attendee custom fields (one JSON blob per attendee type, named "customFields:<typeId>")
  if (types) {
    const updatedTypes = types.map((t) => {
      const raw = String(formData.get(`customFields:${t.id}`) ?? "");
      if (!raw.trim()) return t;
      try {
        const arr = JSON.parse(raw);
        return { ...t, customFields: arr };
      } catch {
        return t;
      }
    });
    await updateEvent(organizer.id, eventId, {
      customQuestions: JSON.stringify(regParsed.data),
      attendeeTypes: JSON.stringify(updatedTypes),
      creationStep: next,
    });
  } else {
    await updateEvent(organizer.id, eventId, {
      customQuestions: JSON.stringify(regParsed.data),
      creationStep: next,
    });
  }
  return { ok: true, eventId, nextStep: next };
}

// ---------- Step 10: Consents (final step — sets creationStep to 'complete') ----------

export async function saveStepConsentsAction(
  eventId: string,
  formData: FormData,
  skip = false,
): Promise<StepResult> {
  const organizer = await requireOrganizer();
  await requireOwnedDraft(organizer.id, eventId);

  if (skip) {
    await updateEvent(organizer.id, eventId, { creationStep: "complete" });
    redirect(`/dashboard/events/${eventId}`);
  }

  const raw = String(formData.get("consentConfig") ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      errors: { consentConfig: "Niepoprawna konfiguracja zgód." },
      values: { consentConfig: raw },
    };
  }
  const r = consentConfigSchema.safeParse(parsed);
  if (!r.success) {
    return {
      errors: { consentConfig: "Niepoprawna konfiguracja zgód." },
      values: { consentConfig: raw },
    };
  }
  await updateEvent(organizer.id, eventId, {
    consentConfig: JSON.stringify(r.data),
    creationStep: "complete",
  });
  redirect(`/dashboard/events/${eventId}`);
}

// ---------- Helpers ----------

function zodIssues(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
```

If `replacePhotosForEvent` doesn't exist yet in `event-photos.ts`, add it as: replace by deleting then inserting (looking at the file's current API will be necessary).

- [ ] **Step 3: Verify `replacePhotosForEvent` exists or add it**

Run: `grep -n "replacePhotosForEvent\|insertEventPhotos" src/lib/db/queries/event-photos.ts`

If missing, append to that file:

```ts
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export async function replacePhotosForEvent(
  eventId: string,
  photos: { url: string; position: number }[],
) {
  const db = getDb();
  await db.delete(schema.eventPhotos).where(eq(schema.eventPhotos.eventId, eventId));
  if (photos.length === 0) return;
  const now = Date.now();
  await db.insert(schema.eventPhotos).values(
    photos.map((p) => ({
      id: crypto.randomUUID(),
      eventId,
      url: p.url,
      position: p.position,
      createdAt: now,
    })),
  );
}
```

(Adjust `id` generation to use the codebase's `newId()` helper from `@/lib/ids` if that's the pattern used by `insertEventPhotos`.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/events/new/wizard-actions.ts src/lib/db/queries/events-dashboard.ts src/lib/db/queries/event-photos.ts
git commit -m "feat(events): per-step server actions for the creation wizard"
```

---

## Task 8: Wizard step components (10 files)

**Files:**
- Create: `src/app/dashboard/events/new/steps/StepTitle.tsx` (and 9 sibling files)

Each step is a client component matching the onboarding pattern: heading, optional subtitle, fields, footer with **Wstecz** + **Dalej** + (where allowed) **Pomiń teraz**. Use existing UI primitives (`Input`, `Textarea`, `Card`, etc.) so spacing matches the rest of the dashboard.

Below are the most important step components. The remaining ones follow the same structure — replicate, vary the fields.

- [ ] **Step 1: `StepTitle.tsx` (with auto-slug + URL preview + "Edytuj URL" toggle)**

Create `src/app/dashboard/events/new/steps/StepTitle.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { slugify } from "@/lib/utils/slug";

type Props = {
  subdomain: string;
  rootDomain: string;
  defaultTitle?: string;
  defaultSlug?: string;
  errors?: { title?: string; slug?: string };
  pending?: boolean;
  onBack: () => void;
  onNext: (title: string, slug: string) => void;
};

export function StepTitle({
  subdomain,
  rootDomain,
  defaultTitle = "",
  defaultSlug = "",
  errors,
  pending,
  onBack,
  onNext,
}: Props) {
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState(defaultSlug);
  const [slugEditedManually, setSlugEditedManually] = useState(defaultSlug.length > 0);
  const [showSlugEditor, setShowSlugEditor] = useState(defaultSlug.length > 0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function handleTitleChange(next: string) {
    setTitle(next);
    if (!slugEditedManually) setSlug(slugify(next));
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onNext(title.trim(), slug.trim().toLowerCase());
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        Jak nazywa się wydarzenie?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Tak będzie widoczne dla uczestniczek na stronie zapisów.
      </p>

      <div className="mt-7 space-y-4">
        <Input
          name="title"
          label="Tytuł"
          required
          maxLength={200}
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          error={errors?.title}
        />

        <div className="rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
          {subdomain}.{rootDomain}/<strong className="text-foreground">{slug || "..."}</strong>
        </div>

        {!showSlugEditor && (
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => setShowSlugEditor(true)}
          >
            Edytuj URL
          </button>
        )}
        {showSlugEditor && (
          <Input
            name="slug"
            label="Adres w URL"
            required
            pattern="[a-z0-9](?:[a-z0-9]|-)*[a-z0-9]"
            minLength={3}
            maxLength={64}
            value={slug}
            onChange={(e) => {
              setSlugEditedManually(true);
              setSlug(e.target.value.toLowerCase());
            }}
            error={errors?.slug}
          />
        )}
      </div>

      <WizardFooter onBack={onBack} pending={pending} />
    </form>
  );
}

function WizardFooter({
  onBack,
  pending,
  showSkip,
  onSkip,
}: {
  onBack: () => void;
  pending?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
}) {
  return (
    <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] disabled:opacity-60 md:flex-1"
      >
        {pending ? "Zapisuję…" : "Dalej →"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] md:w-auto"
      >
        ← Wstecz
      </button>
      {showSkip && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full px-4 py-3 text-sm text-[#6B7280] underline hover:text-[#1E3A5F] md:w-auto"
        >
          Pomiń teraz, ustawię później
        </button>
      )}
    </div>
  );
}

export { WizardFooter };
```

- [ ] **Step 2: `StepDescription.tsx`**

Create `src/app/dashboard/events/new/steps/StepDescription.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultValue?: string;
  error?: string;
  pending?: boolean;
  onBack: () => void;
  onNext: (value: string) => void;
  onSkip: () => void;
};

export function StepDescription({ defaultValue = "", error, pending, onBack, onNext, onSkip }: Props) {
  const [value, setValue] = useState(defaultValue);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); onNext(value); }}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Opowiedz krótko o czym to jest
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Co to za wydarzenie? Co uczestniczki tam zrobią? Możesz pominąć i dopisać później.
      </p>
      <div className="mt-7">
        <Textarea name="description" rows={6} value={value} onChange={(e) => setValue(e.target.value)} maxLength={10_000} error={error} />
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}
```

- [ ] **Step 3: `StepDates.tsx`**

Create `src/app/dashboard/events/new/steps/StepDates.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { EventDateTimeFields } from "@/components/dashboard/EventDateTimeFields";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultStartsAt?: number;
  defaultEndsAt?: number;
  error?: string;
  pending?: boolean;
  onBack: () => void;
  onNext: (startsAtMs: number, endsAtMs: number) => void;
};

export function StepDates({ defaultStartsAt, defaultEndsAt, error, pending, onBack, onNext }: Props) {
  const [, setTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const startsRaw = String(fd.get("startsAt") ?? "");
    const endsRaw = String(fd.get("endsAt") ?? "");
    const starts = startsRaw ? new Date(startsRaw).getTime() : NaN;
    const ends = endsRaw ? new Date(endsRaw).getTime() : NaN;
    if (Number.isFinite(starts) && Number.isFinite(ends)) onNext(starts, ends);
    else setTick((t) => t + 1); // re-render to keep error visible
  }

  return (
    <form ref={formRef} className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Kiedy się odbywa?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Wybierz datę i godzinę początku oraz końca.
      </p>
      <div className="mt-7">
        <EventDateTimeFields defaultStartsAt={defaultStartsAt} defaultEndsAt={defaultEndsAt} error={error} />
      </div>
      <WizardFooter onBack={onBack} pending={pending} />
    </form>
  );
}
```

- [ ] **Step 4: `StepLocation.tsx`**

Create `src/app/dashboard/events/new/steps/StepLocation.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultValue?: string;
  error?: string;
  pending?: boolean;
  onBack: () => void;
  onNext: (value: string) => void;
  onSkip: () => void;
};

export function StepLocation({ defaultValue = "", error, pending, onBack, onNext, onSkip }: Props) {
  const [value, setValue] = useState(defaultValue);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); onNext(value.trim()); }}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Gdzie się odbywa?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Adres, miasto albo nazwa miejsca. Możesz pominąć i dopisać później.
      </p>
      <div className="mt-7">
        <Input name="location" label="Miejsce" value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} error={error} />
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}
```

- [ ] **Step 5: Refactor `AttendeeTypesField` to support `showCustomFieldsEditor`**

In `src/app/dashboard/events/[id]/attendee-types-field.tsx`:

1. Add `showCustomFieldsEditor?: boolean` to the `Props` type (default `true`).
2. Thread it down to `JednaOsobaPresetFields`, `RodzicPresetFields`, `GrupaPresetFields`.
3. In each preset-fields component, wrap the `<AttendeeCustomFieldsEditor>` render and the parent-questions toggle (in `RodzicPresetFields`) in `{showCustomFieldsEditor && (...)}`.

Concrete diff for `JednaOsobaPresetFields` (lines 132-150):

```tsx
function JednaOsobaPresetFields({ types, onChange, showCustomFieldsEditor = true }: { types: AttendeeType[]; onChange: (t: AttendeeType[]) => void; showCustomFieldsEditor?: boolean }) {
  const t = types[0];
  return (
    <div className="space-y-4">
      <label className="text-sm flex flex-col max-w-xs">
        Cena (PLN)
        <ZlotyInput valueCents={t.priceCents}
          onChangeCents={(c) => onChange([{ ...t, priceCents: c }])}
          className="border rounded px-2 py-1" />
      </label>
      <p className="text-xs text-muted-foreground max-w-md">
        Każdy zapisuje tylko siebie. Jeśli chcesz, żeby ktoś mógł zapisać znajomego, wybierz <strong>Grupa</strong>.
      </p>
      {showCustomFieldsEditor && (
        <AttendeeCustomFieldsEditor
          heading="Pytania o uczestnika"
          description="Dodatkowe pytania w formularzu zapisu — np. rozmiar koszulki, alergie, dieta."
          value={t.customFields ?? []}
          onChange={(cf) => onChange([{ ...t, customFields: cf }])}
        />
      )}
    </div>
  );
}
```

Apply the same pattern to `RodzicPresetFields` and `GrupaPresetFields` — wrap the `<AttendeeCustomFieldsEditor>` render and (in `RodzicPresetFields`) the entire collapsible "Pytania o rodzica" block. Add the contextual micro-helper for `GrupaPresetFields` under the max-qty input: *"Tyle osób maksymalnie może zostać zapisanych w jednym zgłoszeniu."*

Then update the `AttendeeTypesField` component itself to accept and forward `showCustomFieldsEditor`:

```tsx
type Props = {
  initialAttendeeTypes: AttendeeType[] | null;
  name?: string;
  priceHiddenName?: string;
  showCustomFieldsEditor?: boolean;
};

export function AttendeeTypesField({ initialAttendeeTypes, name = "attendeeTypes", priceHiddenName = "price", showCustomFieldsEditor = true }: Props) {
  // ... existing body ...
  // pass `showCustomFieldsEditor` to whichever preset fields component is rendered
  {preset === "jedna_osoba" && <JednaOsobaPresetFields types={types} onChange={setTypes} showCustomFieldsEditor={showCustomFieldsEditor} />}
  {preset === "rodzic_z_dziecmi" && <RodzicPresetFields types={types} onChange={setTypes} showCustomFieldsEditor={showCustomFieldsEditor} />}
  {preset === "grupa" && <GrupaPresetFields types={types} onChange={setTypes} showCustomFieldsEditor={showCustomFieldsEditor} />}
  // ... etc ...
}
```

- [ ] **Step 6: `StepAttendees.tsx`**

Create `src/app/dashboard/events/new/steps/StepAttendees.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AttendeeTypesField } from "@/app/dashboard/events/[id]/attendee-types-field";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultAttendeeTypes: AttendeeType[] | null;
  error?: string;
  pending?: boolean;
  onBack: () => void;
  onNext: (attendeeTypesJson: string) => void;
};

export function StepAttendees({ defaultAttendeeTypes, error, pending, onBack, onNext }: Props) {
  const [, setTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const json = String(fd.get("attendeeTypes") ?? "");
    onNext(json);
    setTick((t) => t + 1);
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Kto bierze udział?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Wybierz szablon i ustaw cenę. Pytania o uczestników skonfigurujesz w kolejnym kroku.
      </p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#DC2626]">{error}</p>}
      <div className="mt-7">
        <AttendeeTypesField initialAttendeeTypes={defaultAttendeeTypes} showCustomFieldsEditor={false} />
      </div>
      <WizardFooter onBack={onBack} pending={pending} />
    </form>
  );
}
```

- [ ] **Step 7: `StepCapacity.tsx`**

Create `src/app/dashboard/events/new/steps/StepCapacity.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultValue?: number;
  error?: string;
  pending?: boolean;
  onBack: () => void;
  onNext: (value: number) => void;
};

export function StepCapacity({ defaultValue, error, pending, onBack, onNext }: Props) {
  const [value, setValue] = useState(defaultValue?.toString() ?? "");
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); onNext(Number(value)); }}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Ile osób maksymalnie?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Liczy się każda osoba w zgłoszeniu, też dzieci i osoby zapisane razem (np. w grupie). Jeśli rodzic zapisze siebie i 2 dzieci, to 3 miejsca.
      </p>
      <div className="mt-7">
        <Input name="capacity" type="number" label="Liczba miejsc" min={1} max={10000} required value={value} onChange={(e) => setValue(e.target.value)} error={error} />
      </div>
      <WizardFooter onBack={onBack} pending={pending} />
    </form>
  );
}
```

- [ ] **Step 8: `StepPayment.tsx`**

Create `src/app/dashboard/events/new/steps/StepPayment.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Input, ZlotyInput } from "@/components/ui";
import { WizardFooter } from "./StepTitle";
import { toDatetimeLocalValue, timestampToDdMmYyyyAndTime, parseDdMmYyyy, parseTimeHm } from "@/lib/datetime-form";

type Props = {
  defaultDepositCents?: number | null;
  defaultBalanceDueAt?: number | null;
  errors?: { depositCents?: string; balanceDueAt?: string };
  pending?: boolean;
  onBack: () => void;
  onNext: (depositOn: boolean, depositCents: number | null, balanceDueAt: number | null) => void;
  onSkip: () => void;
};

export function StepPayment({ defaultDepositCents, defaultBalanceDueAt, errors, pending, onBack, onNext, onSkip }: Props) {
  const [depositOn, setDepositOn] = useState(defaultDepositCents != null && defaultDepositCents > 0);
  const [depositCents, setDepositCents] = useState<number>(defaultDepositCents ?? 0);
  const [balanceDueAt, setBalanceDueAt] = useState(() => {
    if (defaultBalanceDueAt == null) return "";
    const { date, time } = timestampToDdMmYyyyAndTime(defaultBalanceDueAt);
    const parts = parseDdMmYyyy(date);
    const t = parseTimeHm(time);
    if (!parts || !t) return "";
    return toDatetimeLocalValue(parts, t);
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ms = balanceDueAt ? new Date(balanceDueAt).getTime() : null;
    onNext(depositOn, depositOn ? depositCents : null, depositOn ? ms : null);
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Jak chcesz pobierać płatność?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Domyślnie uczestniczki płacą całą kwotę przy zapisie. Możesz pobrać tylko zaliczkę i wyznaczyć termin dopłaty.
      </p>
      <div className="mt-7 space-y-4 rounded-2xl bg-white p-5 shadow-[0_8px_20px_rgba(30,58,95,0.06)]">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={depositOn} onChange={(e) => setDepositOn(e.target.checked)} />
          <span>Pobieram tylko zaliczkę</span>
        </label>
        {depositOn && (
          <div className="space-y-3 border-t border-border pt-3">
            <label className="block text-sm">
              Zaliczka za osobę (PLN)
              <ZlotyInput valueCents={depositCents} onChangeCents={setDepositCents} className="mt-1 w-full rounded border border-border px-2 py-1" />
              {errors?.depositCents && <p className="mt-1 text-sm text-destructive">{errors.depositCents}</p>}
            </label>
            <Input name="balanceDueAt" type="datetime-local" label="Termin dopłaty reszty" value={balanceDueAt} onChange={(e) => setBalanceDueAt(e.target.value)} required={depositOn} error={errors?.balanceDueAt} />
          </div>
        )}
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}
```

- [ ] **Step 9: `StepPhotos.tsx`**

Create `src/app/dashboard/events/new/steps/StepPhotos.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { ImageUpload } from "@/components/ui";
import { GalleryUpload } from "@/components/dashboard/GalleryUpload";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultCoverUrl: string | null;
  defaultGalleryPhotos: { url: string; position: number }[];
  pending?: boolean;
  onBack: () => void;
  onNext: (coverUrl: string, galleryPhotosJson: string) => void;
  onSkip: () => void;
};

export function StepPhotos({ defaultCoverUrl, defaultGalleryPhotos, pending, onBack, onNext, onSkip }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onNext(String(fd.get("coverUrl") ?? ""), String(fd.get("galleryPhotos") ?? "[]"));
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Pokaż jak to wygląda
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Okładka to główne zdjęcie wydarzenia. Galeria pokazuje miejsce, atmosferę, poprzednie edycje. Możesz dodać później.
      </p>
      <div className="mt-7 space-y-6">
        <ImageUpload name="coverUrl" label="Zdjęcie okładki" defaultValue={defaultCoverUrl ?? undefined} aspect="cover" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">Galeria zdjęć</p>
          <p className="text-sm text-muted-foreground">Dodaj do 5 zdjęć.</p>
          <GalleryUpload name="galleryPhotos" defaultValue={defaultGalleryPhotos} max={5} />
        </div>
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}
```

- [ ] **Step 10: `StepQuestions.tsx`**

Create `src/app/dashboard/events/new/steps/StepQuestions.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import CustomQuestionsEditor from "@/components/dashboard/CustomQuestionsEditor";
import { AttendeeCustomFieldsEditor } from "@/app/dashboard/events/[id]/AttendeeCustomFieldsEditor";
import type { AttendeeType, AttendeeCustomField } from "@/lib/validators/attendee-types";
import type { CustomQuestion } from "@/lib/validators/event";
import { WizardFooter } from "./StepTitle";

type Props = {
  attendeeTypes: AttendeeType[] | null;
  defaultRegistrationQuestions: CustomQuestion[];
  pending?: boolean;
  onBack: () => void;
  onNext: (
    registrationQuestionsJson: string,
    perAttendeeFieldsByTypeId: Record<string, string>,
  ) => void;
  onSkip: () => void;
};

export function StepQuestions({ attendeeTypes, defaultRegistrationQuestions, pending, onBack, onNext, onSkip }: Props) {
  const [regQuestions, setRegQuestions] = useState<CustomQuestion[]>(defaultRegistrationQuestions);
  const [perTypeFields, setPerTypeFields] = useState<Record<string, AttendeeCustomField[]>>(() => {
    const init: Record<string, AttendeeCustomField[]> = {};
    for (const t of attendeeTypes ?? []) init[t.id] = t.customFields ?? [];
    return init;
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const perTypeJson: Record<string, string> = {};
    for (const t of attendeeTypes ?? []) {
      perTypeJson[t.id] = JSON.stringify(perTypeFields[t.id] ?? []);
    }
    onNext(JSON.stringify(regQuestions), perTypeJson);
  }

  // Determine block layout based on attendee types
  const types = attendeeTypes ?? [];
  const isParent = types.length === 2 && types.some((t) => t.name.toLowerCase() === "rodzic");
  const child = isParent ? types.find((t) => t.name.toLowerCase() === "dziecko") : null;
  const parent = isParent ? types.find((t) => t.name.toLowerCase() === "rodzic") : null;
  const single = !isParent && types.length >= 1 ? types[0] : null;

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        O co chcesz zapytać uczestników?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Wszystkie pytania pojawią się w formularzu zapisu. Możesz pominąć i dodać później.
      </p>
      <div className="mt-7 space-y-4">
        {isParent && child && (
          <Card>
            <h2 className="text-base font-semibold">Pytania o każde dziecko</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pojawią się dla każdego dziecka osobno — np. wiek, alergie, dieta.</p>
            <div className="mt-4">
              <AttendeeCustomFieldsEditor heading="" description="" value={perTypeFields[child.id] ?? []} onChange={(cf) => setPerTypeFields({ ...perTypeFields, [child.id]: cf })} />
            </div>
          </Card>
        )}
        {isParent && parent && (
          <Card>
            <h2 className="text-base font-semibold">Pytania o rodzica <span className="font-normal text-muted-foreground text-sm">(opcjonalne)</span></h2>
            <p className="mt-1 text-sm text-muted-foreground">Imię, email i telefon i tak są zbierane — pytaj tylko o coś dodatkowego, np. nr alarmowy.</p>
            <div className="mt-4">
              <AttendeeCustomFieldsEditor heading="" description="" value={perTypeFields[parent.id] ?? []} onChange={(cf) => setPerTypeFields({ ...perTypeFields, [parent.id]: cf })} />
            </div>
          </Card>
        )}
        {!isParent && single && (
          <Card>
            <h2 className="text-base font-semibold">{single.maxQty > 1 ? "Pytania o każdego uczestnika" : "Pytania o uczestnika"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{single.maxQty > 1 ? "Pojawią się dla każdej osoby w grupie — np. dieta, alergie." : "Pojawią się w formularzu zapisu — np. rozmiar koszulki, dieta."}</p>
            <div className="mt-4">
              <AttendeeCustomFieldsEditor heading="" description="" value={perTypeFields[single.id] ?? []} onChange={(cf) => setPerTypeFields({ ...perTypeFields, [single.id]: cf })} />
            </div>
          </Card>
        )}
        <Card>
          <h2 className="text-base font-semibold">Pytania raz na całe zgłoszenie</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pojawi się raz, niezależnie od liczby osób — np. „Skąd się dowiedziałaś?", uwagi, dane do faktury.</p>
          <div className="mt-4">
            <CustomQuestionsEditor initial={regQuestions} name="customQuestions" onChange={setRegQuestions} />
          </div>
        </Card>
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}
```

If `CustomQuestionsEditor` doesn't currently take an `onChange` prop, add one (it likely already controls a hidden input — the change handler may need to be threaded through; check the file).

- [ ] **Step 11: `StepConsents.tsx`**

Create `src/app/dashboard/events/new/steps/StepConsents.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import EventConsentsEditor from "@/components/dashboard/EventConsentsEditor";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultConsents: ConsentConfigItem[];
  pending?: boolean;
  onBack: () => void;
  onNext: (consentsJson: string) => void;
  onSkip: () => void;
};

export function StepConsents({ defaultConsents, pending, onBack, onNext, onSkip }: Props) {
  const [consents, setConsents] = useState<ConsentConfigItem[]>(defaultConsents);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onNext(JSON.stringify(consents));
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Zgody i regulaminy
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Te zgody są zawsze pokazywane uczestniczkom: regulamin platformy, polityka prywatności, przetwarzanie danych. Poniżej możesz dodać własne — np. zgodę na wykorzystanie wizerunku, regulamin wydarzenia.
      </p>
      <div className="mt-7">
        <EventConsentsEditor initial={consents} name="consentConfig" onChange={setConsents} />
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
        <button type="submit" disabled={pending} className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] disabled:opacity-60 md:flex-1">
          {pending ? "Zapisuję…" : "Zakończ tworzenie →"}
        </button>
        <button type="button" onClick={onBack} className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] md:w-auto">← Wstecz</button>
        <button type="button" onClick={onSkip} className="w-full px-4 py-3 text-sm text-[#6B7280] underline hover:text-[#1E3A5F] md:w-auto">Pomiń teraz, ustawię później</button>
      </div>
    </form>
  );
}
```

If `EventConsentsEditor` doesn't take `onChange`, thread it through similarly to `CustomQuestionsEditor`.

- [ ] **Step 12: Type-check all step files**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 13: Commit**

```bash
git add src/app/dashboard/events/new/steps/ src/app/dashboard/events/[id]/attendee-types-field.tsx
git commit -m "feat(events): wizard step components (10 steps)"
```

---

## Task 9: Wizard controller + new `/dashboard/events/new` route

**Files:**
- Create: `src/app/dashboard/events/new/EventCreationWizard.tsx`
- Modify: `src/app/dashboard/events/new/page.tsx`

The wizard controller holds local state for fields the user is currently editing on a step, plus the canonical "what was last saved" snapshot loaded from server. URL drives the step.

- [ ] **Step 1: Implement the controller**

Create `src/app/dashboard/events/new/EventCreationWizard.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { WizardShell } from "@/app/onboarding/WizardShell";
import { visibleStepsFor, type StepId } from "@/lib/wizard/event-creation-steps";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import {
  saveStepTitleAction,
  saveStepDescriptionAction,
  saveStepDatesAction,
  saveStepLocationAction,
  saveStepAttendeesAction,
  saveStepCapacityAction,
  saveStepPaymentAction,
  saveStepPhotosAction,
  saveStepQuestionsAction,
  saveStepConsentsAction,
  type StepResult,
} from "./wizard-actions";
import { StepTitle } from "./steps/StepTitle";
import { StepDescription } from "./steps/StepDescription";
import { StepDates } from "./steps/StepDates";
import { StepLocation } from "./steps/StepLocation";
import { StepAttendees } from "./steps/StepAttendees";
import { StepCapacity } from "./steps/StepCapacity";
import { StepPayment } from "./steps/StepPayment";
import { StepPhotos } from "./steps/StepPhotos";
import { StepQuestions } from "./steps/StepQuestions";
import { StepConsents } from "./steps/StepConsents";

type SeedEvent = {
  id: string | null;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  startsAt: number | null;
  endsAt: number | null;
  attendeeTypes: AttendeeType[] | null;
  capacity: number;
  depositCents: number | null;
  balanceDueAt: number | null;
  coverUrl: string | null;
  galleryPhotos: { url: string; position: number }[];
  customQuestions: CustomQuestion[];
  consentConfig: ConsentConfigItem[];
};

type Props = {
  subdomain: string;
  rootDomain: string;
  initialStep: StepId;
  initialEvent: SeedEvent;
};

export function EventCreationWizard({ subdomain, rootDomain, initialStep, initialEvent }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const eventId = initialEvent.id;
  const visible = visibleStepsFor(initialEvent.attendeeTypes);
  const stepIndex = Math.max(1, visible.indexOf(initialStep) + 1);
  const totalSteps = visible.length;

  function navigateToStep(next: StepId) {
    setErrors({});
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("step", next);
    if (eventId) sp.set("eventId", eventId);
    router.push(`/dashboard/events/new?${sp.toString()}`);
  }

  function handleResult(result: StepResult) {
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    if (result.nextStep === "complete") {
      router.push(`/dashboard/events/${result.eventId}`);
      return;
    }
    navigateToStep(result.nextStep);
  }

  function back() {
    if (stepIndex <= 1) return;
    const prev = visible[stepIndex - 2];
    navigateToStep(prev);
  }

  function renderStep() {
    switch (initialStep) {
      case "tytul":
        return (
          <StepTitle
            subdomain={subdomain}
            rootDomain={rootDomain}
            defaultTitle={initialEvent.title}
            defaultSlug={initialEvent.slug}
            errors={errors}
            pending={pending}
            onBack={() => router.push("/dashboard")}
            onNext={(title, slug) =>
              startTransition(async () => {
                const fd = new FormData();
                fd.set("title", title);
                fd.set("slug", slug);
                handleResult(await saveStepTitleAction(eventId, fd));
              })
            }
          />
        );
      case "opis":
        return (
          <StepDescription
            defaultValue={initialEvent.description ?? ""}
            error={errors.description}
            pending={pending}
            onBack={back}
            onNext={(value) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("description", value);
                handleResult(await saveStepDescriptionAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepDescriptionAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "termin":
        return (
          <StepDates
            defaultStartsAt={initialEvent.startsAt ?? undefined}
            defaultEndsAt={initialEvent.endsAt ?? undefined}
            error={errors.startsAt ?? errors.endsAt}
            pending={pending}
            onBack={back}
            onNext={(starts, ends) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("startsAt", new Date(starts).toISOString());
                fd.set("endsAt", new Date(ends).toISOString());
                handleResult(await saveStepDatesAction(eventId, fd));
              })
            }
          />
        );
      case "miejsce":
        return (
          <StepLocation
            defaultValue={initialEvent.location ?? ""}
            error={errors.location}
            pending={pending}
            onBack={back}
            onNext={(value) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("location", value);
                handleResult(await saveStepLocationAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepLocationAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "uczestnicy":
        return (
          <StepAttendees
            defaultAttendeeTypes={initialEvent.attendeeTypes}
            error={errors.attendeeTypes}
            pending={pending}
            onBack={back}
            onNext={(json) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("attendeeTypes", json);
                handleResult(await saveStepAttendeesAction(eventId, fd));
              })
            }
          />
        );
      case "miejsca":
        return (
          <StepCapacity
            defaultValue={initialEvent.capacity}
            error={errors.capacity}
            pending={pending}
            onBack={back}
            onNext={(value) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("capacity", String(value));
                handleResult(await saveStepCapacityAction(eventId, fd));
              })
            }
          />
        );
      case "platnosc":
        return (
          <StepPayment
            defaultDepositCents={initialEvent.depositCents}
            defaultBalanceDueAt={initialEvent.balanceDueAt}
            errors={{ depositCents: errors.depositCents, balanceDueAt: errors.balanceDueAt }}
            pending={pending}
            onBack={back}
            onNext={(depositOn, depositCents, balanceDueAtMs) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("depositOn", depositOn ? "true" : "");
                if (depositCents != null) fd.set("deposit", String(depositCents / 100));
                if (balanceDueAtMs != null) fd.set("balanceDueAt", new Date(balanceDueAtMs).toISOString());
                handleResult(await saveStepPaymentAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepPaymentAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "zdjecia":
        return (
          <StepPhotos
            defaultCoverUrl={initialEvent.coverUrl}
            defaultGalleryPhotos={initialEvent.galleryPhotos}
            pending={pending}
            onBack={back}
            onNext={(coverUrl, galleryJson) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("coverUrl", coverUrl);
                fd.set("galleryPhotos", galleryJson);
                handleResult(await saveStepPhotosAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepPhotosAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "pytania":
        return (
          <StepQuestions
            attendeeTypes={initialEvent.attendeeTypes}
            defaultRegistrationQuestions={initialEvent.customQuestions}
            pending={pending}
            onBack={back}
            onNext={(regQuestionsJson, perTypeJson) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("customQuestions", regQuestionsJson);
                for (const [typeId, json] of Object.entries(perTypeJson)) {
                  fd.set(`customFields:${typeId}`, json);
                }
                handleResult(await saveStepQuestionsAction(eventId, fd));
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                handleResult(await saveStepQuestionsAction(eventId, new FormData(), true));
              })
            }
          />
        );
      case "zgody":
        return (
          <StepConsents
            defaultConsents={initialEvent.consentConfig}
            pending={pending}
            onBack={back}
            onNext={(consentsJson) =>
              startTransition(async () => {
                if (!eventId) return;
                const fd = new FormData();
                fd.set("consentConfig", consentsJson);
                await saveStepConsentsAction(eventId, fd);
                // Action redirects on success.
              })
            }
            onSkip={() =>
              startTransition(async () => {
                if (!eventId) return;
                await saveStepConsentsAction(eventId, new FormData(), true);
                // Action redirects on success.
              })
            }
          />
        );
      default:
        return null;
    }
  }

  return (
    <WizardShell currentStep={stepIndex} totalSteps={totalSteps}>
      {renderStep()}
    </WizardShell>
  );
}
```

- [ ] **Step 2: Replace `page.tsx` content**

Replace `src/app/dashboard/events/new/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer } from "@/lib/db/queries/events-dashboard";
import { listPhotosForEvent } from "@/lib/db/queries/event-photos";
import { isStepIdValid, type StepId } from "@/lib/wizard/event-creation-steps";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { EventCreationWizard } from "./EventCreationWizard";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; eventId?: string }>;
}) {
  const sp = await searchParams;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/onboarding");

  const eventId = sp.eventId ?? null;
  let initialEvent = null;
  if (eventId) {
    initialEvent = await getEventForOrganizer(organizer.id, eventId);
    if (!initialEvent) redirect("/dashboard");
    if (initialEvent.status !== "draft" || initialEvent.creationStep === "complete") {
      redirect(`/dashboard/events/${eventId}`);
    }
  }

  // Resolve the step. Default to first step (tytul) for fresh starts.
  // If user passed ?step=… that's beyond their saved progress, redirect to their saved step.
  const requestedStep = isStepIdValid(sp.step) ? sp.step : "tytul";
  let activeStep: StepId = requestedStep;
  if (initialEvent && initialEvent.creationStep && initialEvent.creationStep !== "complete") {
    // Don't let user skip past their progress
    activeStep = isStepIdValid(initialEvent.creationStep)
      ? (initialEvent.creationStep as StepId)
      : requestedStep;
  }

  const galleryPhotos = eventId ? await listPhotosForEvent(eventId) : [];
  const attendeeTypes: AttendeeType[] | null = initialEvent?.attendeeTypes
    ? JSON.parse(initialEvent.attendeeTypes)
    : null;

  return (
    <EventCreationWizard
      subdomain={organizer.subdomain}
      rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl"}
      initialStep={activeStep}
      initialEvent={{
        id: eventId,
        title: initialEvent?.title ?? "",
        slug: initialEvent?.slug ?? "",
        description: initialEvent?.description ?? null,
        location: initialEvent?.location ?? null,
        startsAt: initialEvent?.startsAt ?? null,
        endsAt: initialEvent?.endsAt ?? null,
        attendeeTypes,
        capacity: initialEvent?.capacity ?? 1,
        depositCents: initialEvent?.depositCents ?? null,
        balanceDueAt: initialEvent?.balanceDueAt ?? null,
        coverUrl: initialEvent?.coverUrl ?? null,
        galleryPhotos: galleryPhotos.map((p) => ({ url: p.url, position: p.position })),
        customQuestions: initialEvent?.customQuestions ? JSON.parse(initialEvent.customQuestions) : [],
        consentConfig: initialEvent?.consentConfig ? JSON.parse(initialEvent.consentConfig) : [],
      }}
    />
  );
}
```

- [ ] **Step 3: Manually smoke-test the wizard end-to-end**

Run: `npm run dev` (in another terminal). Visit `http://localhost:3000/dashboard/events/new`. Walk through all 10 steps for a paid event, confirm each "Dalej" advances; back navigation works; the row appears in DB after Step 1.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/events/new/EventCreationWizard.tsx src/app/dashboard/events/new/page.tsx
git commit -m "feat(events): wire wizard controller and new event route"
```

---

## Task 10: `section-status.ts` (TDD)

**Files:**
- Create: `src/app/dashboard/events/[id]/section-status.ts`
- Test: `src/app/dashboard/events/[id]/section-status.test.ts`

This pure function turns an event row into per-section status. The rail and the publish-gate both use it.

- [ ] **Step 1: Write the failing tests**

Create `src/app/dashboard/events/[id]/section-status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeSectionStatus, isPublishable } from "./section-status";

const validBase = {
  title: "Wydarzenie",
  slug: "wydarzenie",
  description: null,
  location: null,
  startsAt: 100,
  endsAt: 200,
  capacity: 10,
  attendeeTypes: JSON.stringify([{ id: "a", name: "Osoba", priceCents: 100, minQty: 1, maxQty: 1 }]),
  depositCents: null,
  balanceDueAt: null,
  coverUrl: null,
  customQuestions: JSON.stringify([]),
  consentConfig: JSON.stringify([]),
};

describe("computeSectionStatus", () => {
  it("flags required sections as filled when valid", () => {
    const s = computeSectionStatus(validBase, []);
    expect(s.podstawy).toBe("filled");
    expect(s.termin).toBe("filled");
    expect(s.uczestnicy).toBe("filled");
    expect(s.miejsca).toBe("filled");
  });
  it("flags optional sections as empty when missing", () => {
    const s = computeSectionStatus(validBase, []);
    expect(s.miejsce).toBe("empty");
    expect(s.zdjecia).toBe("empty");
    expect(s.pytania).toBe("empty");
  });
  it("flags Płatność as 'free' when no price", () => {
    const ev = { ...validBase, attendeeTypes: JSON.stringify([{ id: "a", name: "Osoba", priceCents: 0, minQty: 1, maxQty: 1 }]) };
    const s = computeSectionStatus(ev, []);
    expect(s.platnosc).toBe("free");
  });
});

describe("isPublishable", () => {
  it("returns true for a complete event", () => {
    expect(isPublishable(validBase, []).ok).toBe(true);
  });
  it("returns missing fields", () => {
    const r = isPublishable({ ...validBase, capacity: 0 }, []);
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("capacity");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- section-status`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/app/dashboard/events/[id]/section-status.ts`:

```ts
import type { AttendeeType } from "@/lib/validators/attendee-types";

export type SectionId =
  | "podstawy"
  | "termin"
  | "miejsce"
  | "uczestnicy"
  | "miejsca"
  | "platnosc"
  | "zdjecia"
  | "pytania"
  | "zgody";

export type SectionStatus = "filled" | "empty" | "free";

export type EventForStatus = {
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  startsAt: number;
  endsAt: number;
  capacity: number;
  attendeeTypes: string | null;
  depositCents: number | null;
  balanceDueAt: number | null;
  coverUrl: string | null;
  customQuestions: string | null;
  consentConfig: string | null;
};

function attendeeTypesArray(json: string | null): AttendeeType[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export function computeSectionStatus(
  ev: EventForStatus,
  galleryPhotos: { url: string }[],
): Record<SectionId, SectionStatus> {
  const types = attendeeTypesArray(ev.attendeeTypes);
  const isFree = !types || types.every((t) => t.priceCents === 0);
  const customQuestions = ev.customQuestions ? safeParseArray(ev.customQuestions) : [];
  const perAttendeeQuestions =
    (types ?? []).reduce((sum, t) => sum + (t.customFields?.length ?? 0), 0) > 0;
  const consents = ev.consentConfig ? safeParseArray(ev.consentConfig) : [];

  return {
    podstawy: ev.title.length > 0 && ev.slug.length > 0 ? "filled" : "empty",
    termin: ev.startsAt > 0 && ev.endsAt > ev.startsAt ? "filled" : "empty",
    miejsce: ev.location && ev.location.length > 0 ? "filled" : "empty",
    uczestnicy: types && types.length > 0 ? "filled" : "empty",
    miejsca: ev.capacity >= 1 ? "filled" : "empty",
    platnosc: isFree ? "free" : ev.depositCents != null && ev.balanceDueAt != null ? "filled" : "empty",
    zdjecia: ev.coverUrl || galleryPhotos.length > 0 ? "filled" : "empty",
    pytania: customQuestions.length > 0 || perAttendeeQuestions ? "filled" : "empty",
    zgody: consents.length > 0 ? "filled" : "empty",
  };
}

export type PublishCheck =
  | { ok: true }
  | { ok: false; missing: string[] };

export function isPublishable(
  ev: EventForStatus,
  galleryPhotos: { url: string }[],
): PublishCheck {
  void galleryPhotos; // not part of publishability — kept in signature for symmetry
  const missing: string[] = [];
  if (!ev.title || ev.title.length === 0) missing.push("title");
  if (!ev.slug || ev.slug.length < 3) missing.push("slug");
  if (!(ev.startsAt > 0 && ev.endsAt > ev.startsAt)) missing.push("startsAt/endsAt");
  if (ev.capacity < 1) missing.push("capacity");
  const types = attendeeTypesArray(ev.attendeeTypes);
  if (!types || types.length === 0) missing.push("attendeeTypes");
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

function safeParseArray(s: string): unknown[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- section-status`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/events/[id]/section-status.ts src/app/dashboard/events/[id]/section-status.test.ts
git commit -m "feat(events): section-status pure logic"
```

---

## Task 11: Section components (refactored from `EventEditForm`)

**Files:**
- Create: `src/app/dashboard/events/[id]/sections/Section{Basics,Dates,Location,Attendees,Capacity,Payment,Photos,Questions,Consents}.tsx`

Each section is a `<form action={saveSection<X>Action.bind(null, eventId)}>` rendering its slice of the edit view. The "Zapisz zmiany" button at the bottom is per-section. The output of `useActionState` drives an inline "Zapisano" or error.

Use the same field components (`Input`, `Textarea`, `EventDateTimeFields`, `AttendeeTypesField`, `ZlotyInput`, `ImageUpload`, `GalleryUpload`, `CustomQuestionsEditor`, `EventConsentsEditor`) used in the wizard, configured for section-level save.

**Shared section shell.** All sections share a wrapper. Create a small helper to keep them consistent.

- [ ] **Step 1: Create the shared section shell**

Create `src/app/dashboard/events/[id]/sections/SectionShell.tsx`:

```tsx
"use client";

import { type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui";

type Props = {
  id: string; // anchor id (e.g. "podstawy")
  title: string;
  description?: string;
  /** Bound server action: `saveSection<X>Action.bind(null, eventId)` */
  action: (prev: { ok: true } | { errors: Record<string, string> } | null, formData: FormData) => Promise<{ ok: true } | { errors: Record<string, string> }>;
  /** Result from `useActionState` — passed in by the parent for inline error/success display. */
  state: { ok: true } | { errors: Record<string, string> } | null;
  children: ReactNode;
};

export function SectionShell({ id, title, description, action, state, children }: Props) {
  return (
    <section id={id} className="scroll-mt-20">
      <Card>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <form action={action} className="mt-5 space-y-4">
          {children}
          <div className="flex items-center gap-3">
            <SubmitButton />
            {state && "ok" in state && <p className="text-sm text-success">Zapisano.</p>}
          </div>
        </form>
      </Card>
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
      {pending ? "Zapisuję…" : "Zapisz zmiany"}
    </button>
  );
}
```

- [ ] **Step 2: `SectionBasics.tsx`**

Create `src/app/dashboard/events/[id]/sections/SectionBasics.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { Input, Textarea } from "@/components/ui";
import { saveSectionBasicsAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = {
  eventId: string;
  subdomain: string;
  rootDomain: string;
  initial: { title: string; slug: string; description: string };
};

export function SectionBasics({ eventId, subdomain, rootDomain, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(saveSectionBasicsAction.bind(null, eventId), null);
  const [slug, setSlug] = useState(initial.slug);
  const errors = state && "errors" in state ? state.errors : {};

  return (
    <SectionShell id="podstawy" title="Podstawy" action={action} state={state}>
      <Input name="title" label="Tytuł" defaultValue={initial.title} required maxLength={200} error={errors.title} />
      <div>
        <Input name="slug" label="Adres w URL" required pattern="[a-z0-9](?:[a-z0-9]|-)*[a-z0-9]" minLength={3} maxLength={64} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} error={errors.slug} />
        <p className="mt-1.5 rounded-lg bg-muted/60 px-3 py-1.5 font-mono text-xs text-muted-foreground">
          {subdomain}.{rootDomain}/<strong className="text-foreground">{slug || "..."}</strong>
        </p>
      </div>
      <Textarea name="description" label="Opis" defaultValue={initial.description} rows={6} error={errors.description} />
    </SectionShell>
  );
}
```

- [ ] **Step 3: `SectionDates.tsx`**

Create `src/app/dashboard/events/[id]/sections/SectionDates.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { EventDateTimeFields } from "@/components/dashboard/EventDateTimeFields";
import { saveSectionDatesAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initial: { startsAt: number; endsAt: number } };

export function SectionDates({ eventId, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(saveSectionDatesAction.bind(null, eventId), null);
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell id="termin" title="Termin" action={action} state={state}>
      <EventDateTimeFields defaultStartsAt={initial.startsAt} defaultEndsAt={initial.endsAt} error={errors.startsAt ?? errors.endsAt} />
    </SectionShell>
  );
}
```

- [ ] **Step 4: `SectionLocation.tsx`**

Create `src/app/dashboard/events/[id]/sections/SectionLocation.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui";
import { saveSectionLocationAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initial: { location: string } };

export function SectionLocation({ eventId, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(saveSectionLocationAction.bind(null, eventId), null);
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell id="miejsce" title="Miejsce" action={action} state={state}>
      <Input name="location" label="Adres / miejsce" defaultValue={initial.location} maxLength={200} error={errors.location} />
    </SectionShell>
  );
}
```

- [ ] **Step 5: `SectionAttendees.tsx`**

Create `src/app/dashboard/events/[id]/sections/SectionAttendees.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { AttendeeTypesField } from "../attendee-types-field";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { saveSectionAttendeesAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initialAttendeeTypes: AttendeeType[] | null };

export function SectionAttendees({ eventId, initialAttendeeTypes }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(saveSectionAttendeesAction.bind(null, eventId), null);
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell id="uczestnicy" title="Uczestnicy i ceny" description="Pytania o uczestnikach edytujesz w sekcji Pytania." action={action} state={state}>
      {errors.attendeeTypes && <p className="text-sm text-destructive">{errors.attendeeTypes}</p>}
      <AttendeeTypesField initialAttendeeTypes={initialAttendeeTypes} showCustomFieldsEditor={false} />
    </SectionShell>
  );
}
```

- [ ] **Step 6: `SectionCapacity.tsx`**

Create `src/app/dashboard/events/[id]/sections/SectionCapacity.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui";
import { saveSectionCapacityAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initial: { capacity: number } };

export function SectionCapacity({ eventId, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(saveSectionCapacityAction.bind(null, eventId), null);
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell id="miejsca" title="Liczba miejsc" description="Liczy się każda osoba w zgłoszeniu — także dzieci i osoby zapisane razem (np. w grupie)." action={action} state={state}>
      <Input name="capacity" type="number" label="Liczba miejsc" min={1} max={10000} required defaultValue={initial.capacity} error={errors.capacity} />
    </SectionShell>
  );
}
```

- [ ] **Step 7: `SectionPayment.tsx`**

Create `src/app/dashboard/events/[id]/sections/SectionPayment.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { Input, Card, ZlotyInput } from "@/components/ui";
import { saveSectionPaymentAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";
import { timestampToDdMmYyyyAndTime, parseDdMmYyyy, parseTimeHm, toDatetimeLocalValue } from "@/lib/datetime-form";

type Props = {
  eventId: string;
  initial: { depositCents: number | null; balanceDueAt: number | null };
  isFree: boolean;
};

export function SectionPayment({ eventId, initial, isFree }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(saveSectionPaymentAction.bind(null, eventId), null);
  const [depositOn, setDepositOn] = useState(initial.depositCents != null && initial.depositCents > 0);
  const [depositCents, setDepositCents] = useState<number>(initial.depositCents ?? 0);
  const [balanceDueAt, setBalanceDueAt] = useState(() => {
    if (initial.balanceDueAt == null) return "";
    const { date, time } = timestampToDdMmYyyyAndTime(initial.balanceDueAt);
    const parts = parseDdMmYyyy(date);
    const t = parseTimeHm(time);
    return parts && t ? toDatetimeLocalValue(parts, t) : "";
  });
  const errors = state && "errors" in state ? state.errors : {};

  if (isFree) {
    return (
      <section id="platnosc" className="scroll-mt-20">
        <Card>
          <h2 className="text-base font-semibold">Płatność</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Wydarzenie darmowe — pobieranie zaliczek nie ma zastosowania. Aby włączyć płatności, dodaj cenę w sekcji <strong>Uczestnicy</strong>.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <SectionShell id="platnosc" title="Płatność" action={action} state={state}>
      <input type="hidden" name="depositOn" value={depositOn ? "true" : ""} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={depositOn} onChange={(e) => setDepositOn(e.target.checked)} />
        <span>Pobieram tylko zaliczkę</span>
      </label>
      {depositOn && (
        <div className="space-y-3 border-t border-border pt-3">
          <label className="block text-sm">
            Zaliczka za osobę (PLN)
            <ZlotyInput valueCents={depositCents} onChangeCents={setDepositCents} className="mt-1 w-full rounded border border-border px-2 py-1" />
            <input type="hidden" name="deposit" value={(depositCents / 100).toString()} />
            {errors.depositCents && <p className="mt-1 text-sm text-destructive">{errors.depositCents}</p>}
          </label>
          <Input name="balanceDueAt" type="datetime-local" label="Termin dopłaty reszty" value={balanceDueAt} onChange={(e) => setBalanceDueAt(e.target.value)} required={depositOn} error={errors.balanceDueAt} />
        </div>
      )}
    </SectionShell>
  );
}
```

- [ ] **Step 8: `SectionPhotos.tsx`**

Create `src/app/dashboard/events/[id]/sections/SectionPhotos.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { ImageUpload } from "@/components/ui";
import { GalleryUpload } from "@/components/dashboard/GalleryUpload";
import { saveSectionPhotosAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; coverUrl: string | null; galleryPhotos: { url: string; position: number }[] };

export function SectionPhotos({ eventId, coverUrl, galleryPhotos }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(saveSectionPhotosAction.bind(null, eventId), null);
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell id="zdjecia" title="Zdjęcia" description="Okładka + galeria (do 5 zdjęć)." action={action} state={state}>
      <ImageUpload name="coverUrl" label="Zdjęcie okładki" defaultValue={coverUrl ?? undefined} aspect="cover" error={errors.coverUrl} />
      <GalleryUpload name="galleryPhotos" defaultValue={galleryPhotos} max={5} error={errors.galleryPhotos} />
    </SectionShell>
  );
}
```

- [ ] **Step 9: `SectionQuestions.tsx`**

Create `src/app/dashboard/events/[id]/sections/SectionQuestions.tsx`. Mirrors `StepQuestions` exactly — preset-driven block layout, hidden inputs named `customFields:<typeId>` and `customQuestions`. The only difference is the wrapping `SectionShell` and `useActionState` for submit.

Use `StepQuestions`'s implementation as the template, replace the `<form>` + footer with a `<SectionShell>` + the children-as-form-content pattern.

```tsx
"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui";
import CustomQuestionsEditor from "@/components/dashboard/CustomQuestionsEditor";
import { AttendeeCustomFieldsEditor } from "../AttendeeCustomFieldsEditor";
import type { AttendeeType, AttendeeCustomField } from "@/lib/validators/attendee-types";
import type { CustomQuestion } from "@/lib/validators/event";
import { saveSectionQuestionsAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = {
  eventId: string;
  attendeeTypes: AttendeeType[] | null;
  initialCustomQuestions: CustomQuestion[];
};

export function SectionQuestions({ eventId, attendeeTypes, initialCustomQuestions }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(saveSectionQuestionsAction.bind(null, eventId), null);
  const [regQuestions, setRegQuestions] = useState<CustomQuestion[]>(initialCustomQuestions);
  const [perTypeFields, setPerTypeFields] = useState<Record<string, AttendeeCustomField[]>>(() => {
    const init: Record<string, AttendeeCustomField[]> = {};
    for (const t of attendeeTypes ?? []) init[t.id] = t.customFields ?? [];
    return init;
  });

  const types = attendeeTypes ?? [];
  const isParent = types.length === 2 && types.some((t) => t.name.toLowerCase() === "rodzic");
  const child = isParent ? types.find((t) => t.name.toLowerCase() === "dziecko") : null;
  const parent = isParent ? types.find((t) => t.name.toLowerCase() === "rodzic") : null;
  const single = !isParent && types.length >= 1 ? types[0] : null;

  return (
    <SectionShell id="pytania" title="Pytania w formularzu zapisu" action={action} state={state}>
      {/* Hidden inputs reflect current state */}
      <input type="hidden" name="customQuestions" value={JSON.stringify(regQuestions)} />
      {Object.entries(perTypeFields).map(([typeId, fields]) => (
        <input key={typeId} type="hidden" name={`customFields:${typeId}`} value={JSON.stringify(fields)} />
      ))}
      {isParent && child && (
        <Card>
          <h3 className="text-sm font-semibold">Pytania o każde dziecko</h3>
          <p className="mt-1 text-xs text-muted-foreground">Pojawią się dla każdego dziecka osobno — np. wiek, alergie.</p>
          <div className="mt-3"><AttendeeCustomFieldsEditor heading="" description="" value={perTypeFields[child.id] ?? []} onChange={(cf) => setPerTypeFields({ ...perTypeFields, [child.id]: cf })} /></div>
        </Card>
      )}
      {isParent && parent && (
        <Card>
          <h3 className="text-sm font-semibold">Pytania o rodzica <span className="font-normal text-muted-foreground text-xs">(opcjonalne)</span></h3>
          <p className="mt-1 text-xs text-muted-foreground">Imię, email i telefon i tak są zbierane.</p>
          <div className="mt-3"><AttendeeCustomFieldsEditor heading="" description="" value={perTypeFields[parent.id] ?? []} onChange={(cf) => setPerTypeFields({ ...perTypeFields, [parent.id]: cf })} /></div>
        </Card>
      )}
      {!isParent && single && (
        <Card>
          <h3 className="text-sm font-semibold">{single.maxQty > 1 ? "Pytania o każdego uczestnika" : "Pytania o uczestnika"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{single.maxQty > 1 ? "Pojawią się dla każdej osoby w grupie." : "Pojawią się w formularzu zapisu."}</p>
          <div className="mt-3"><AttendeeCustomFieldsEditor heading="" description="" value={perTypeFields[single.id] ?? []} onChange={(cf) => setPerTypeFields({ ...perTypeFields, [single.id]: cf })} /></div>
        </Card>
      )}
      <Card>
        <h3 className="text-sm font-semibold">Pytania raz na całe zgłoszenie</h3>
        <p className="mt-1 text-xs text-muted-foreground">Pojawi się raz, niezależnie od liczby osób.</p>
        <div className="mt-3"><CustomQuestionsEditor initial={regQuestions} name="customQuestions" onChange={setRegQuestions} /></div>
      </Card>
    </SectionShell>
  );
}
```

- [ ] **Step 10: `SectionConsents.tsx`**

Create `src/app/dashboard/events/[id]/sections/SectionConsents.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import EventConsentsEditor from "@/components/dashboard/EventConsentsEditor";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import { saveSectionConsentsAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = { eventId: string; initial: ConsentConfigItem[] };

export function SectionConsents({ eventId, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(saveSectionConsentsAction.bind(null, eventId), null);
  const [consents, setConsents] = useState<ConsentConfigItem[]>(initial);
  return (
    <SectionShell id="zgody" title="Zgody i regulaminy" description="Zgody platformy są obowiązkowe i wyświetlane automatycznie. Możesz dodać własne." action={action} state={state}>
      <input type="hidden" name="consentConfig" value={JSON.stringify(consents)} />
      <EventConsentsEditor initial={consents} name="consentConfig" onChange={setConsents} />
    </SectionShell>
  );
}
```

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 12: Commit**

```bash
git add src/app/dashboard/events/[id]/sections/
git commit -m "feat(events): per-section components for unified edit view"
```

---

## Task 12: Per-section server actions

**Files:**
- Create: `src/app/dashboard/events/[id]/section-actions.ts`

Each `saveSection<X>Action(eventId, prev, formData)` returns `{ ok: true } | { errors }`. They mirror the wizard actions but DO NOT touch `creationStep`. They DO touch `updatedAt` (via `updateEvent`).

- [ ] **Step 1: Implement all section actions**

Create `src/app/dashboard/events/[id]/section-actions.ts`:

```ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer, updateEvent, isSlugTakenForOrganizer } from "@/lib/db/queries/events-dashboard";
import {
  stepTitleSchema,
  stepDescriptionSchema,
  stepDatesSchema,
  stepLocationSchema,
  stepCapacitySchema,
  stepPaymentSchema,
} from "@/lib/validators/event-wizard";
import { attendeeTypesSchema, type AttendeeType } from "@/lib/validators/attendee-types";
import { customQuestionSchema } from "@/lib/validators/event";
import { consentConfigSchema } from "@/lib/validators/consent";
import { replacePhotosForEvent } from "@/lib/db/queries/event-photos";

export type SectionResult = { ok: true } | { errors: Record<string, string> };

async function authorize(eventId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  const ev = await getEventForOrganizer(organizer.id, eventId);
  if (!ev) throw new Error("Not found");
  return { organizer, ev };
}

function zodIssues(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

function loadAttendeeTypes(json: string | null): AttendeeType[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as AttendeeType[]) : null;
  } catch {
    return null;
  }
}

function pricesMax(types: AttendeeType[] | null): number {
  if (!types || types.length === 0) return 0;
  return types.reduce((m, t) => Math.max(m, t.priceCents), 0);
}

// ---------- Basics ----------

export async function saveSectionBasicsAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer, ev } = await authorize(eventId);
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "");
  const titleParsed = stepTitleSchema.safeParse({ title, slug });
  if (!titleParsed.success) return { errors: zodIssues(titleParsed.error.issues) };
  const descParsed = stepDescriptionSchema.safeParse({ description });
  if (!descParsed.success) return { errors: zodIssues(descParsed.error.issues) };
  if (slug !== ev.slug && (await isSlugTakenForOrganizer(organizer.id, slug))) {
    return { errors: { slug: "Ta nazwa w URL jest już zajęta" } };
  }
  await updateEvent(organizer.id, eventId, {
    title: titleParsed.data.title,
    slug: titleParsed.data.slug,
    description: description.trim() || null,
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Dates ----------

export async function saveSectionDatesAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const startsRaw = String(formData.get("startsAt") ?? "");
  const endsRaw = String(formData.get("endsAt") ?? "");
  const startsAt = startsRaw ? new Date(startsRaw).getTime() : NaN;
  const endsAt = endsRaw ? new Date(endsRaw).getTime() : NaN;
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return { errors: { startsAt: "Wybierz daty.", endsAt: "Wybierz daty." } };
  }
  const parsed = stepDatesSchema.safeParse({ startsAt, endsAt });
  if (!parsed.success) return { errors: zodIssues(parsed.error.issues) };
  await updateEvent(organizer.id, eventId, {
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Location ----------

export async function saveSectionLocationAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const location = String(formData.get("location") ?? "");
  const parsed = stepLocationSchema.safeParse({ location });
  if (!parsed.success) return { errors: zodIssues(parsed.error.issues) };
  await updateEvent(organizer.id, eventId, { location: location.trim() || null });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Attendees ----------

export async function saveSectionAttendeesAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const raw = String(formData.get("attendeeTypes") ?? "");
  if (!raw.trim()) return { errors: { attendeeTypes: "Wybierz szablon i ustaw cenę." } };
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { errors: { attendeeTypes: "Niepoprawna konfiguracja typów uczestników." } };
  }
  const parsed = attendeeTypesSchema.safeParse(parsedJson);
  if (!parsed.success) return { errors: { attendeeTypes: "Niepoprawna konfiguracja typów uczestników." } };
  const types = parsed.data as AttendeeType[];
  await updateEvent(organizer.id, eventId, {
    attendeeTypes: JSON.stringify(types),
    priceCents: pricesMax(types),
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Capacity ----------

export async function saveSectionCapacityAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const capacity = Number(formData.get("capacity") ?? "0");
  const parsed = stepCapacitySchema.safeParse({ capacity });
  if (!parsed.success) return { errors: zodIssues(parsed.error.issues) };
  await updateEvent(organizer.id, eventId, { capacity: parsed.data.capacity });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Payment ----------

export async function saveSectionPaymentAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const depositOn = formData.get("depositOn") === "true";
  const depositRaw = String(formData.get("deposit") ?? "");
  const balanceDueRaw = String(formData.get("balanceDueAt") ?? "");
  const depositCents = depositRaw ? Math.round(Number(depositRaw) * 100) : null;
  const balanceDueAt = balanceDueRaw ? new Date(balanceDueRaw).getTime() : null;
  const parsed = stepPaymentSchema.safeParse({ depositOn, depositCents, balanceDueAt });
  if (!parsed.success) return { errors: zodIssues(parsed.error.issues) };
  await updateEvent(organizer.id, eventId, {
    depositCents: depositOn ? depositCents : null,
    balanceDueAt: depositOn ? balanceDueAt : null,
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Photos ----------

export async function saveSectionPhotosAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const coverUrl = String(formData.get("coverUrl") ?? "");
  const galleryRaw = String(formData.get("galleryPhotos") ?? "[]");
  let gallery: { url: string; position: number }[] = [];
  try {
    const arr = JSON.parse(galleryRaw);
    if (Array.isArray(arr)) {
      gallery = arr
        .filter(
          (p: unknown): p is { url: string; position: number } =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as Record<string, unknown>).url === "string" &&
            ((p as Record<string, unknown>).url as string).startsWith("/api/images/") &&
            typeof (p as Record<string, unknown>).position === "number" &&
            Number.isInteger((p as Record<string, unknown>).position),
        )
        .slice(0, 5);
    }
  } catch {
    /* ignore */
  }
  await updateEvent(organizer.id, eventId, { coverUrl: coverUrl || null });
  await replacePhotosForEvent(eventId, gallery);
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Questions ----------

const customQuestionsArraySchema = z.array(customQuestionSchema).max(20);

export async function saveSectionQuestionsAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer, ev } = await authorize(eventId);
  const regRaw = String(formData.get("customQuestions") ?? "[]");
  let regParsedRaw: unknown;
  try {
    regParsedRaw = JSON.parse(regRaw);
  } catch {
    return { errors: { customQuestions: "Niepoprawna konfiguracja pytań." } };
  }
  const reg = customQuestionsArraySchema.safeParse(regParsedRaw);
  if (!reg.success) return { errors: { customQuestions: "Niepoprawna konfiguracja pytań." } };

  const types = loadAttendeeTypes(ev.attendeeTypes);
  const updatedTypes = types
    ? types.map((t) => {
        const raw = String(formData.get(`customFields:${t.id}`) ?? "");
        if (!raw.trim()) return t;
        try {
          const arr = JSON.parse(raw);
          return Array.isArray(arr) ? { ...t, customFields: arr } : t;
        } catch {
          return t;
        }
      })
    : null;

  await updateEvent(organizer.id, eventId, {
    customQuestions: JSON.stringify(reg.data),
    ...(updatedTypes ? { attendeeTypes: JSON.stringify(updatedTypes) } : {}),
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

// ---------- Consents ----------

export async function saveSectionConsentsAction(
  eventId: string,
  _prev: SectionResult | null,
  formData: FormData,
): Promise<SectionResult> {
  const { organizer } = await authorize(eventId);
  const raw = String(formData.get("consentConfig") ?? "[]");
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(raw);
  } catch {
    return { errors: { consentConfig: "Niepoprawna konfiguracja zgód." } };
  }
  const r = consentConfigSchema.safeParse(parsedRaw);
  if (!r.success) return { errors: { consentConfig: "Niepoprawna konfiguracja zgód." } };
  await updateEvent(organizer.id, eventId, { consentConfig: JSON.stringify(r.data) });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/events/[id]/section-actions.ts
git commit -m "feat(events): per-section save actions for unified edit view"
```

---

## Task 13: `SectionRail` (desktop) + `SectionSheet` (mobile)

**Files:**
- Create: `src/app/dashboard/events/[id]/SectionRail.tsx`
- Create: `src/app/dashboard/events/[id]/SectionSheet.tsx`

The rail is the desktop sticky sidebar; the sheet is the mobile bottom-sheet. Both consume the same `SectionStatus` data and the same publish CTA logic.

- [ ] **Step 1: `SectionRail.tsx`**

Create:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { SectionId, SectionStatus } from "./section-status";

const SECTION_LABELS: Record<SectionId, string> = {
  podstawy: "Podstawy",
  termin: "Termin",
  miejsce: "Miejsce",
  uczestnicy: "Uczestnicy",
  miejsca: "Liczba miejsc",
  platnosc: "Płatność",
  zdjecia: "Zdjęcia",
  pytania: "Pytania",
  zgody: "Zgody",
};

type Props = {
  status: Record<SectionId, SectionStatus>;
  publishSlot: React.ReactNode; // <PublishButton> rendered by parent
};

export function SectionRail({ status, publishSlot }: Props) {
  const [active, setActive] = useState<SectionId | null>(null);

  useEffect(() => {
    const sections = Object.keys(SECTION_LABELS) as SectionId[];
    const elements = sections
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost visible
          const topMost = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
          setActive(topMost.target.id as SectionId);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function jumpTo(id: SectionId) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <aside className="sticky top-6 hidden w-[200px] shrink-0 sm:block">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sekcje
      </p>
      <ul className="mt-3 space-y-1">
        {(Object.keys(SECTION_LABELS) as SectionId[]).map((id) => {
          const s = status[id];
          const isActive = active === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => jumpTo(id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? "border-l-2 border-[#E8683A] bg-[#FFF4ED] pl-2.5"
                    : "border-l-2 border-transparent hover:bg-muted"
                }`}
              >
                <span aria-hidden className="w-3 text-xs">
                  {s === "filled" ? "✓" : s === "free" ? "○" : "○"}
                </span>
                <span className={s === "filled" ? "text-foreground" : "text-muted-foreground"}>
                  {SECTION_LABELS[id]}
                </span>
                {s === "free" && id === "platnosc" && (
                  <span className="text-[10px] text-muted-foreground">— darmowe</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 border-t border-border pt-4">{publishSlot}</div>
    </aside>
  );
}
```

- [ ] **Step 2: Export `SECTION_LABELS` from `SectionRail.tsx`**

In the file you just created, change `const SECTION_LABELS` to `export const SECTION_LABELS` so the sheet can import it.

- [ ] **Step 3: `SectionSheet.tsx`**

Create `src/app/dashboard/events/[id]/SectionSheet.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { SECTION_LABELS } from "./SectionRail";
import type { SectionId, SectionStatus } from "./section-status";

type Props = {
  status: Record<SectionId, SectionStatus>;
  publishSlot: React.ReactNode;
};

export function SectionSheet({ status, publishSlot }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const filledCount = (Object.values(status) as SectionStatus[]).filter((s) => s === "filled" || s === "free").length;
  const total = Object.keys(SECTION_LABELS).length;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function jumpTo(id: SectionId) {
    setOpen(false);
    triggerRef.current?.focus();
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Wydarzenie</div>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Sekcje ▾
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex flex-1 gap-1">
            {(Object.keys(SECTION_LABELS) as SectionId[]).map((id) => {
              const s = status[id];
              const bg = s === "filled" ? "bg-[#1E3A5F]" : s === "free" ? "bg-[#1E3A5F]/40" : "bg-[#F4E5DC]";
              return <div key={id} className={`h-1 flex-1 rounded-full ${bg}`} />;
            })}
          </div>
          <span>{filledCount} z {total} sekcji wypełnionych</span>
        </div>
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Sekcje wydarzenia" className="fixed inset-0 z-40 flex items-end bg-black/40 sm:hidden" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full rounded-t-2xl bg-background p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Sekcje</h2>
              <button ref={closeRef} type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} aria-label="Zamknij" className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
                ✕
              </button>
            </div>
            <ul className="space-y-1">
              {(Object.keys(SECTION_LABELS) as SectionId[]).map((id) => {
                const s = status[id];
                return (
                  <li key={id}>
                    <button type="button" onClick={() => jumpTo(id)} className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-muted">
                      <span aria-hidden className="w-3 text-xs">{s === "filled" ? "✓" : "○"}</span>
                      <span className={s === "filled" ? "text-foreground" : "text-muted-foreground"}>{SECTION_LABELS[id]}</span>
                      {s === "free" && id === "platnosc" && <span className="text-[10px] text-muted-foreground">— darmowe</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t border-border pt-4">{publishSlot}</div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/events/[id]/SectionRail.tsx src/app/dashboard/events/[id]/SectionSheet.tsx
git commit -m "feat(events): SectionRail + SectionSheet for unified edit view"
```

---

## Task 14: `EventEditView` + page rewrite

**Files:**
- Create: `src/app/dashboard/events/[id]/EventEditView.tsx`
- Modify: `src/app/dashboard/events/[id]/page.tsx`
- Modify: `src/app/dashboard/events/[id]/actions.ts` (add `publishEventAction` wrapper)

The new edit view composes: post-wizard banner (conditional) + sticky rail/sheet + main content with all 9 sections in order.

- [ ] **Step 1: Modify `changeStatusAction` to set `publishedAt` on first publish**

Edit `src/app/dashboard/events/[id]/actions.ts` line 189-203 (`changeStatusAction`). Replace with:

```ts
import { markPublishedFirstTimeIfNeeded } from "@/lib/db/queries/events-dashboard";

export async function changeStatusAction(eventId: string, status: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) throw new Error("Invalid status");
  if (parsed.data === "published") {
    if (organizer.stripeOnboardingComplete !== 1 || organizer.stripePayoutsEnabled !== 1) {
      throw new Error("Publikacja wymaga ukończenia konfiguracji Stripe.");
    }
    await markPublishedFirstTimeIfNeeded(organizer.id, eventId);
  }
  await updateEvent(organizer.id, eventId, { status: parsed.data });
  revalidatePath(`/dashboard/events/${eventId}`);
}
```

The `markPublishedFirstTimeIfNeeded` helper from Task 7 reads the row and only writes `publishedAt = Date.now()` if it's currently `null`. This matches the spec invariant: set once on first publish, never reset.

- [ ] **Step 2: Create `PublishControls.tsx`**

Create `src/app/dashboard/events/[id]/PublishControls.tsx`:

```tsx
"use client";

import Link from "next/link";
import { changeStatusAction } from "./actions";

type Props = {
  eventId: string;
  eventStatus: "draft" | "published" | "archived";
  stripeReady: boolean;
  publishable: boolean;
  missing: string[];
};

export function PublishControls({ eventId, eventStatus, stripeReady, publishable, missing }: Props) {
  const publishBound = changeStatusAction.bind(null, eventId, "published");
  const unpublishBound = changeStatusAction.bind(null, eventId, "draft");
  const archiveBound = changeStatusAction.bind(null, eventId, "archived");
  const canPublish = publishable && stripeReady;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status: {statusLabel(eventStatus)}</p>
      {eventStatus === "published" ? (
        <form action={unpublishBound}>
          <button type="submit" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted">
            Ukryj (cofnij publikację)
          </button>
        </form>
      ) : (
        <>
          <form action={publishBound}>
            <button
              type="submit"
              disabled={!canPublish}
              title={!stripeReady ? "Dokończ konfigurację Stripe, aby opublikować" : !publishable ? `Brakuje: ${missing.join(", ")}` : undefined}
              className="w-full rounded-md bg-[#E8683A] px-3 py-2 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Opublikuj
            </button>
          </form>
          {!stripeReady && (
            <Link href="/dashboard/onboarding/payouts" className="block text-center text-xs text-yellow-700 underline">
              Dokończ konfigurację Stripe
            </Link>
          )}
        </>
      )}
      {eventStatus !== "archived" && (
        <form action={archiveBound}>
          <button type="submit" className="w-full rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            Archiwizuj
          </button>
        </form>
      )}
    </div>
  );
}

function statusLabel(s: "draft" | "published" | "archived"): string {
  if (s === "draft") return "Szkic";
  if (s === "published") return "Opublikowane";
  return "Zarchiwizowane";
}
```

- [ ] **Step 3: Implement `EventEditView.tsx`**

Create `src/app/dashboard/events/[id]/EventEditView.tsx`:

```tsx
"use client";

import { SectionRail } from "./SectionRail";
import { SectionSheet } from "./SectionSheet";
import { computeSectionStatus, isPublishable, type EventForStatus } from "./section-status";
import { SectionBasics } from "./sections/SectionBasics";
import { SectionDates } from "./sections/SectionDates";
import { SectionLocation } from "./sections/SectionLocation";
import { SectionAttendees } from "./sections/SectionAttendees";
import { SectionCapacity } from "./sections/SectionCapacity";
import { SectionPayment } from "./sections/SectionPayment";
import { SectionPhotos } from "./sections/SectionPhotos";
import { SectionQuestions } from "./sections/SectionQuestions";
import { SectionConsents } from "./sections/SectionConsents";
import { PublishControls } from "./PublishControls";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";

type FullEvent = EventForStatus & {
  status: "draft" | "published" | "archived";
  creationStep: string | null;
  publishedAt: number | null;
};

type Props = {
  eventId: string;
  event: FullEvent;
  galleryPhotos: { url: string; position: number }[];
  attendeeTypes: AttendeeType[] | null;
  customQuestions: CustomQuestion[];
  consents: ConsentConfigItem[];
  subdomain: string;
  rootDomain: string;
  stripeReady: boolean;
};

export function EventEditView({
  eventId,
  event,
  galleryPhotos,
  attendeeTypes,
  customQuestions,
  consents,
  subdomain,
  rootDomain,
  stripeReady,
}: Props) {
  const status = computeSectionStatus(event, galleryPhotos);
  const publishCheck = isPublishable(event, galleryPhotos);
  const showPostWizardBanner =
    event.creationStep === "complete" &&
    event.status === "draft" &&
    event.publishedAt === null;

  const publishSlot = (
    <PublishControls
      eventId={eventId}
      eventStatus={event.status}
      stripeReady={stripeReady}
      publishable={publishCheck.ok}
      missing={publishCheck.ok ? [] : publishCheck.missing}
    />
  );

  return (
    <div>
      <SectionSheet status={status} publishSlot={publishSlot} />
      <div className="flex gap-6">
        <SectionRail status={status} publishSlot={publishSlot} />
        <main className="min-w-0 flex-1 space-y-6">
          {showPostWizardBanner && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm">
                <strong>✓ Wszystko gotowe — sprawdź szczegóły i kliknij Opublikuj.</strong>
                {!stripeReady && " Najpierw dokończ konfigurację Stripe."}
              </p>
            </div>
          )}
          <SectionBasics
            eventId={eventId}
            subdomain={subdomain}
            rootDomain={rootDomain}
            initial={{ title: event.title, slug: event.slug, description: event.description ?? "" }}
          />
          <SectionDates eventId={eventId} initial={{ startsAt: event.startsAt, endsAt: event.endsAt }} />
          <SectionLocation eventId={eventId} initial={{ location: event.location ?? "" }} />
          <SectionAttendees eventId={eventId} initialAttendeeTypes={attendeeTypes} />
          <SectionCapacity eventId={eventId} initial={{ capacity: event.capacity }} />
          <SectionPayment
            eventId={eventId}
            initial={{ depositCents: event.depositCents, balanceDueAt: event.balanceDueAt }}
            isFree={status.platnosc === "free"}
          />
          <SectionPhotos eventId={eventId} coverUrl={event.coverUrl} galleryPhotos={galleryPhotos} />
          <SectionQuestions
            eventId={eventId}
            attendeeTypes={attendeeTypes}
            initialCustomQuestions={customQuestions}
          />
          <SectionConsents eventId={eventId} initial={consents} />
        </main>
      </div>
    </div>
  );
}
```

The `EventForStatus` type from `section-status.ts` doesn't include `depositCents`/`balanceDueAt` — extend it there to include these two fields so `SectionPayment` props line up. Update `section-status.ts` accordingly:

```ts
export type EventForStatus = {
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  startsAt: number;
  endsAt: number;
  capacity: number;
  attendeeTypes: string | null;
  depositCents: number | null;
  balanceDueAt: number | null;
  coverUrl: string | null;
  customQuestions: string | null;
  consentConfig: string | null;
};
```

(It's already there in the Task 10 implementation — verify it during this task.)

- [ ] **Step 4: Rewrite `page.tsx`**

Modify `src/app/dashboard/events/[id]/page.tsx`. Replace the existing implementation (lines 21-233) with the structure below. Key changes from current:
- Remove the publish/unpublish/archive `<form>` blocks from the header (lines 76-127).
- Replace `<EventEditForm>` (line 175-194) with `<EventEditView>`.
- Keep the participants tab logic untouched.

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer } from "@/lib/db/queries/events-dashboard";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import { parseEventDashboardTab } from "@/lib/eventDashboardTab";
import { parseParticipantFilterStatus } from "@/lib/participantFilterStatus";
import { ParticipantFilters } from "@/components/dashboard/ParticipantFilters";
import ParticipantsTable from "@/components/dashboard/ParticipantsTable";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { Button, Card, StatusBadge } from "@/components/ui";
import { publicEventUrl } from "@/lib/urls";
import { listPhotosForEvent } from "@/lib/db/queries/event-photos";
import { EventEditView } from "./EventEditView";

export default async function EventEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { status: statusParam, tab: tabParam } = await searchParams;
  const dashboardTab = parseEventDashboardTab(tabParam);
  const statusFilter = parseParticipantFilterStatus(statusParam);
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/onboarding");
  const event = await getEventForOrganizer(organizer.id, id);
  if (!event) notFound();

  const customQuestions: CustomQuestion[] = event.customQuestions ? JSON.parse(event.customQuestions) : [];
  const consents: ConsentConfigItem[] = event.consentConfig ? JSON.parse(event.consentConfig) : [];
  const eventPhotos = await listPhotosForEvent(id);
  const initialPhotos = eventPhotos.map((p) => ({ url: p.url, position: p.position }));
  const attendeeTypes: AttendeeType[] | null = event.attendeeTypes ? JSON.parse(event.attendeeTypes) : null;

  const stripeReady =
    organizer.stripeOnboardingComplete === 1 && organizer.stripePayoutsEnabled === 1;
  const previewUrl = publicEventUrl(organizer.subdomain, event.slug);
  const editHref = `/dashboard/events/${id}`;
  const participantsHref = `/dashboard/events/${id}?tab=uczestnicy`;

  return (
    <div>
      {/* Header (passive identity strip — no action buttons) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={event.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{event.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm sm:justify-end">
          {event.status === "published" && (
            <>
              <Button href={previewUrl} target="_blank" rel="noopener noreferrer" variant="ghost" size="sm">Podgląd</Button>
              <CopyLinkButton url={previewUrl} />
            </>
          )}
        </div>
      </div>

      {/* Status hints (kept) */}
      {event.status === "draft" && event.creationStep !== "complete" && (
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Szkic w trakcie tworzenia.</strong>{" "}
          {event.creationStep && (
            <Link href={`/dashboard/events/new?eventId=${id}&step=${event.creationStep}`} className="text-primary underline">
              Dokończ tworzenie →
            </Link>
          )}
        </div>
      )}
      {event.status === "archived" && (
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Zarchiwizowane.</strong> Wydarzenie nie jest już widoczne publicznie.
        </div>
      )}

      {/* Tab switcher (kept) */}
      <nav className="mt-6 flex gap-1 rounded-xl border border-border bg-muted/40 p-1" aria-label="Widok wydarzenia">
        <Link href={editHref} className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-5 ${dashboardTab === "edycja" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} aria-current={dashboardTab === "edycja" ? "page" : undefined}>
          Edycja
        </Link>
        <Link href={participantsHref} className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-5 ${dashboardTab === "uczestnicy" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} aria-current={dashboardTab === "uczestnicy" ? "page" : undefined}>
          Uczestnicy
        </Link>
      </nav>

      {dashboardTab === "edycja" ? (
        <div className="mt-6">
          <EventEditView
            eventId={id}
            event={{
              title: event.title,
              slug: event.slug,
              description: event.description,
              location: event.location,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              capacity: event.capacity,
              attendeeTypes: event.attendeeTypes,
              depositCents: event.depositCents ?? null,
              balanceDueAt: event.balanceDueAt ?? null,
              coverUrl: event.coverUrl,
              customQuestions: event.customQuestions,
              consentConfig: event.consentConfig,
              status: event.status as "draft" | "published" | "archived",
              creationStep: event.creationStep ?? null,
              publishedAt: event.publishedAt ?? null,
            }}
            galleryPhotos={initialPhotos}
            attendeeTypes={attendeeTypes}
            customQuestions={customQuestions}
            consents={consents}
            subdomain={organizer.subdomain}
            rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl"}
            stripeReady={stripeReady}
          />
        </div>
      ) : (
        <section className="mt-6">
          <ParticipantsSection
            eventId={event.id}
            eventCapacity={event.capacity}
            eventPriceCents={event.priceCents}
            questions={customQuestions}
            attendeeTypes={attendeeTypes}
            statusFilter={statusFilter}
          />
        </section>
      )}
    </div>
  );
}
```

The `ParticipantsSection` async server component is currently defined inline at the bottom of the existing `page.tsx` (lines 235-336). Keep its definition unchanged — paste it after the `EventEditPage` component in the new file. Its props and behavior are identical.

Also restore the `<a href=".../export">` "Eksport CSV" link that the current participants tab renders above the table — it's part of `ParticipantsSection`'s outer wrapper. Verify by visually comparing to the pre-change page.

- [ ] **Step 5: Manually smoke-test the edit view**

Run: `npm run dev`. Open an existing event. Verify:
- Rail renders with section labels and ✓/○ icons
- Clicking a rail item scrolls smoothly to that section
- Saving a section shows "Zapisano" inline
- Mobile (DevTools narrow viewport) shows the sheet
- Publish CTA disabled when validation fails or Stripe not ready

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/events/[id]/EventEditView.tsx src/app/dashboard/events/[id]/PublishControls.tsx src/app/dashboard/events/[id]/page.tsx src/app/dashboard/events/[id]/actions.ts
git commit -m "feat(events): unified edit view replaces EventEditForm"
```

---

## Task 15: Dashboard "Dokończ tworzenie" CTA

**Files:**
- Modify: `src/components/dashboard/DashboardEventCard.tsx`
- Modify: `src/lib/db/queries/events-dashboard.ts` if needed (ensure list returns `creationStep`)

- [ ] **Step 1: Read the current event card**

Run: `cat src/components/dashboard/DashboardEventCard.tsx`

Identify the JSX where actions/status are rendered.

- [ ] **Step 2: Add the resume CTA**

Add a conditional in `DashboardEventCard.tsx`. When `event.creationStep && event.creationStep !== "complete"`:

```tsx
{event.creationStep && event.creationStep !== "complete" && (
  <Link
    href={`/dashboard/events/new?eventId=${event.id}&step=${event.creationStep}`}
    className="inline-flex items-center gap-1 rounded-md bg-[#E8683A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d05a30]"
  >
    Dokończ tworzenie →
  </Link>
)}
```

(Replace the styling tokens with whatever convention the existing card uses for CTAs.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Manually smoke-test**

In dev, start a new event but stop after Step 3. Return to dashboard — verify "Dokończ tworzenie" link appears for that event and routes back into the wizard at Step 4 (`miejsce`).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardEventCard.tsx
git commit -m "feat(dashboard): Dokończ tworzenie CTA for unfinished wizard drafts"
```

---

## Task 16: Cleanup — delete dead code

**Files:**
- Delete: `src/app/dashboard/events/new/NewEventForm.tsx`
- Delete: `src/app/dashboard/events/new/actions.ts` (verify no other importer)
- Delete: `src/app/dashboard/events/[id]/EventEditForm.tsx`
- Delete: `src/components/dashboard/EventDateTimeRange.tsx` (verify no other importer)

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -rn "NewEventForm\|EventEditForm\|EventDateTimeRange\|createEventAction\|saveEventAction" src/ --include="*.tsx" --include="*.ts"`
Expected: only references in the files we're about to delete.

If any remaining references — fix them first (likely a stale import in `page.tsx`).

- [ ] **Step 2: Delete the files**

```bash
git rm src/app/dashboard/events/new/NewEventForm.tsx
git rm src/app/dashboard/events/new/actions.ts
git rm src/app/dashboard/events/[id]/EventEditForm.tsx
git rm src/components/dashboard/EventDateTimeRange.tsx
```

- [ ] **Step 3: Type-check + run all tests**

Run: `npx tsc --noEmit && npm test`
Expected: No errors. All tests green.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(events): remove pre-wizard NewEventForm/EventEditForm/EventDateTimeRange"
```

---

## Task 17: Manual smoke test (full flow)

**No code changes — verify the full feature works end-to-end.**

- [ ] **Step 1: Start a fresh paid event**

Run: `npm run dev`

Visit `/dashboard/events/new`. Walk through all 10 steps:

1. Tytuł "Test event" → URL preview shows `<subdomain>.wyjazdo.pl/test-event`
2. Opis "Krótki opis" → "Dalej"
3. Termin: pick start 2026-06-01 09:00, end 2026-06-03 17:00 → duration shows "2 dni 8 godz." → "Dalej"
4. Miejsce "Warszawa" → "Dalej"
5. Uczestnicy: pick "Tylko siebie", set price 100 zł → "Dalej"
6. Liczba miejsc: 20 → helper text visible → "Dalej"
7. Płatność: check "Pobieram tylko zaliczkę", deposit 50 zł, balanceDueAt 2026-05-25 → "Dalej"
8. Zdjęcia: skip → "Pomiń teraz"
9. Pytania: add "Skąd wiesz?" to "Raz na zgłoszenie" → "Dalej"
10. Zgody: skip → "Zakończ tworzenie"

Expected: redirect to `/dashboard/events/<id>` with the post-wizard banner visible. All sections in the rail show their state.

- [ ] **Step 2: Resume a partial draft**

Start a new event, fill only Steps 1–3, close the tab. Return to `/dashboard`. Verify "Dokończ tworzenie" CTA appears on that event card. Click it — wizard resumes at Step 4 (Miejsce).

- [ ] **Step 3: Free event flow**

Create another event. At Step 5, set all prices to 0. Continue. Verify Step 7 (Płatność) is skipped — the progress bar shows 9 segments, and "Dalej" on Step 6 lands on Step 8 (Zdjęcia).

In the resulting edit view, verify the rail's "Płatność" item shows "○ — darmowe", and clicking it scrolls to a section with the "Wydarzenie darmowe…" placeholder.

- [ ] **Step 4: Date-picker isolation**

In the edit view, open the Termin section. Click into "Początek" — change just the start date. Verify "Koniec" stays untouched. (This was the original bug.)

- [ ] **Step 5: Mobile**

Resize browser to phone width (≤640px). Verify:
- Sticky top bar shows progress + "Sekcje ▾" button
- Tap opens bottom sheet with section list
- Tap a section → sheet closes + scrolls to anchor
- Section save works

- [ ] **Step 6: Publish**

Verify the rail's "Opublikuj" button is enabled (assuming Stripe is ready in dev). Click it. Verify status flips to "published" and `event.publishedAt` is set in the DB. Banner disappears.

- [ ] **Step 7: Existing event regression**

Open an event that existed before this PR (creation_step is NULL). Verify the edit view loads, the post-wizard banner does NOT appear, and editing/saving sections works.

- [ ] **Step 8: Final commit (none expected — smoke only)**

If any issue is found, fix it before merging. Otherwise, create the PR.

---

## Self-review notes

- Existing drafts (legacy rows): `creation_step = NULL`. Banner condition checks `=== "complete"` — won't fire. ✓
- Free events: `visibleStepsFor` excludes `platnosc`. Edit view shows it as "○ — darmowe" with a placeholder section. ✓
- Date-picker bug: replaced range mode entirely. Each picker is independent. ✓
- Questions split: per-attendee `customFields` and per-registration `customQuestions` both edited on Step 9 / Section 9. ✓
- URL hacking: `page.tsx` clamps `requestedStep` to the saved `creationStep`. ✓
- Resume flow: `creationStep` per-step PATCH + dashboard CTA. ✓
- Stripe gating: existing logic reused via `PublishControls`. ✓

The plan touches 30+ files and is large. If executing with subagent-driven-development, expect ~17 subagent dispatches (one per task). Tasks 1–4 and 10 are standalone TDD tasks, easy to verify. Tasks 5–9 build the wizard. Tasks 11–14 build the edit view. Task 15 ties dashboard back to wizard. Tasks 16–17 are cleanup + smoke.

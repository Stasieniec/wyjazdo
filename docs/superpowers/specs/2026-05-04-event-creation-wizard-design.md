# Event Creation Wizard + Unified Edit View

**Status:** Design
**Date:** 2026-05-04
**Audience:** Polish-speaking organizers, primarily women 40–50, often less tech-savvy. Same persona as onboarding wizard.

## Problem

Today's event creation is a 2-step "create then edit" flow:

- Step 1 (`/dashboard/events/new`, `NewEventForm.tsx`) crams title, slug, dates, location, attendee preset (with per-attendee custom questions hidden inside), pricing, capacity, cover, gallery into one screen and leaves it at "Kontynuuj".
- Step 2 (`/dashboard/events/[id]`, `EventEditForm.tsx`) is the same fields again, plus per-registration questions and consents, plus a small post-creation banner. The same form is also the permanent edit form, so it can't be optimized for either context.

Concrete pain points:

- **Questions are split across two places.** Per-attendee questions hide inside the attendee-type preset config (Step 1). Per-registration questions live only in Step 2. There is no single "questions" surface.
- **Date range picker breaks start-date editing.** `EventDateTimeRange` uses `react-day-picker` in `mode="range"`. Once both endpoints are picked, clicking a third date resets the range — there is no clean "move just the start" action.
- **Step 6-equivalent block conflates unrelated concerns.** `Cena, zapisy i uczestnicy` and the surrounding capacity/deposit/balance-due grid mix venue capacity (a logistics concern) with deposit + balance-due-at (a payment-flow concern).
- **Step 1 ↔ Step 2 ambiguity.** Same fields, two contexts. New organizers don't know whether they "finished creating" after Step 1, and existing organizers see a confusing "Krok 2 z 2" banner months later when they reopen the same form to edit.
- **Reading load.** Long forms with many sections render all at once with no overview, no progress indicator, and no per-section "this is where you are" affordance.

## Goal

Replace the 2-step "create then edit" flow with:

1. A **step-by-step wizard** at `/dashboard/events/new` that goes through every detail, one concept per screen, in the same visual language as the onboarding wizard.
2. A **single unified edit view** at `/dashboard/events/[id]` used both as the post-wizard review screen and as the long-term edit screen for existing events.

The wizard is the path *to* the edit view; the edit view is where everything is changeable, always.

## Architecture

Three concrete pieces:

- **`/dashboard/events/new`** — the wizard route. Each step is reflected in the URL (`?step=tytul`, `?step=termin`, …). Server actions persist a draft event row eagerly: as soon as Step 1's "Dalej" is clicked, the row exists with `status = 'draft'`. Each subsequent step PATCHes that row. Closing the tab loses nothing — the draft persists, and the dashboard surfaces a "Dokończ tworzenie" CTA that resumes at the last unsaved step.
- **`/dashboard/events/[id]`** — the unified edit view. Same component for two contexts:
    - *Post-wizard review* — banner reads "✓ Wszystko gotowe — sprawdź szczegóły i kliknij **Opublikuj**" (or "Dokończ konfigurację Stripe…" if Stripe is not ready). Banner is shown iff `creationStep === null AND status === 'draft' AND publishedAt === null`. Adding `event.publishedAt` (nullable timestamp, set on first publish) ensures the banner stays gone forever even if the event is later unpublished.
    - *Later editing* — no banner; the existing status badge stays.
- **`/dashboard/events/[id]?step=…`** — the same wizard URL pattern resumes from the dashboard's "Dokończ tworzenie" link. The wizard is reachable only while `event.creationStep` is non-null (i.e., the wizard hasn't been completed). Once completed, that link disappears.

### Reused

- `WizardShell` from onboarding — paste-reused, not forked. Same coral/navy palette, same `bg-[#FFF8F4]` background, same progress strip.
- `eventBaseSchema`, `attendeeTypesSchema` (server-side validation, unchanged).
- `AttendeeTypesField` internals — preset chooser logic, `JednaOsobaPresetFields` / `RodzicPresetFields` / `GrupaPresetFields`. Refactored so per-attendee `customFields` editing is *removable* from the preset fields and rendered separately on the questions step.
- `ZlotyInput`, `CustomQuestionsEditor`, `EventConsentsEditor`, `GalleryUpload`, `ImageUpload`, `Card`, `Input`, `SubmitButton`, `Textarea`.
- `TimePickerSelects`.

### Replaced

- `EventDateTimeRange` — kill range mode entirely. Replaced by two independent date+time pickers, each with its own popover calendar.
- `NewEventForm.tsx` — removed. New: a thin step controller component + per-step components.
- `EventEditForm.tsx` — refactored: per-section components (one per rail entry), plus a section-rail / mobile-sheet shell.

### New

- `event.creationStep` (TEXT, nullable) added to schema. Stores the step id the user should land on next (`"opis"`, `"termin"`, `"miejsce"`, `"uczestnicy"`, `"miejsca"`, `"platnosc"`, `"zdjecia"`, `"pytania"`, `"zgody"`, or `null` once complete).
- `event.publishedAt` (INTEGER unix-ms, nullable) added to schema. Set to `Date.now()` on first publish; never reset. Drives the post-wizard banner visibility (banner hides forever once the event has ever been published).
- Per-step server actions, replacing the single `createEventAction`: `saveStep<X>Action(eventId | null, formData)`. Step 1's variant additionally creates the row.
- Per-section server actions for the edit view: `saveSection<X>Action(eventId, formData)`. Each saves only its slice; no global "save everything" button.
- Migration: `event.creationStep` defaults to `null` (existing events bypass the wizard-completion path). `event.publishedAt` backfilled to `updatedAt` for any existing rows where `status = 'published'`, otherwise `null`.

## Wizard steps

Order is fixed. Step 7 (Płatność) is dynamically removed from the route map when the event is free (sum of attendee-type prices = 0); the progress bar shows 9 segments instead of 10. If the user goes back and adds a price, Step 7 reappears.

Each step uses `WizardShell` with `currentStep` and `totalSteps` reflecting the *visible* count. Layout per step: heading, optional subtitle, fields, footer with **Wstecz** + **Dalej** + (where allowed) **Pomiń teraz** link.

| # | id | Title | Fields | Required to advance | Skip-for-now |
|---|---|---|---|---|---|
| 1 | `tytul` | Jak nazywa się wydarzenie? | `title`, auto-derived `slug` with inline preview ("twoja-domena.wyjazdo.pl/np-warsztaty-kwietniowe") + "Edytuj URL" link to override | yes | no |
| 2 | `opis` | Opowiedz krótko o czym to jest | `description` (Textarea, no minimum length) | no | yes |
| 3 | `termin` | Kiedy się odbywa? | Two independent date+time pickers ("Początek" / "Koniec"). Each opens its own popover calendar. Live duration hint below ("Czas trwania: 4 dni 8 godz.") | yes | no |
| 4 | `miejsce` | Gdzie się odbywa? | `location` (free-text input) | no | yes |
| 5 | `uczestnicy` | Kto bierze udział? | Preset chooser (3 cards with rewritten copy — see below) → preset-contextual fields: prices via `ZlotyInput`, max qty where relevant, parent-discount toggle for `rodzic_z_dziecmi`. **No questions configured here.** | yes | no |
| 6 | `miejsca` | Ile osób maksymalnie? | `capacity` (number). Helper: *"Liczy się każda osoba w zgłoszeniu, też dzieci i osoby zapisane razem (np. w grupie). Jeśli rodzic zapisze siebie i 2 dzieci, to 3 miejsca."* | yes | no |
| 7 | `platnosc` | Jak chcesz pobierać płatność? | Default state: "Cała kwota przy zapisie." Checkbox **"Pobieram tylko zaliczkę"** reveals `deposit` (per-person PLN via `ZlotyInput`) + `balanceDueAt` (`datetime-local`). Step is skipped from the flow entirely if event is free | only if checkbox on | yes |
| 8 | `zdjecia` | Pokaż jak to wygląda | `coverUrl` (`ImageUpload`) + `galleryPhotos` (`GalleryUpload`, max 5) | no | yes |
| 9 | `pytania` | O co chcesz zapytać uczestników? | Stacked sections, preset-driven. See "Questions step composition" below. | no | yes |
| 10 | `zgody` | Zgody i regulaminy | Platform consents auto-included as read-only chips at the top. Custom consents below via `EventConsentsEditor`. Final "Dalej" → `/dashboard/events/[id]` review. | no | yes |

### Preset copy (Step 5)

Replaces the current `PRESET_LABELS` in `src/lib/attendee-presets.ts`:

| id | Title | Description |
|---|---|---|
| `jedna_osoba` | **Tylko siebie** | Każda osoba zapisuje **tylko siebie**. Jedno zgłoszenie = jedna osoba. Najprostsze. |
| `rodzic_z_dziecmi` | **Rodzic z dziećmi** | Rodzic zapisuje siebie i swoje dzieci w jednym zgłoszeniu. Możesz mieć inną cenę dla dziecka i pytać o każde dziecko osobno (wiek, alergie). |
| `grupa` | **Grupa (kilka osób na raz)** | Jedna osoba zapisuje **siebie i znajomych** w jednym zgłoszeniu — np. razem z koleżanką albo całym zespołem. Ty ustalasz, ile osób maksymalnie może być w jednym zgłoszeniu. |

Plus contextual micro-helpers:

- *Tylko siebie* — under the price field: *"Każdy zapisuje tylko siebie. Jeśli chcesz, żeby ktoś mógł zapisać znajomego, wybierz **Grupa**."*
- *Grupa* — under the "Maksymalna liczba uczestników" field: *"Tyle osób maksymalnie może zostać zapisanych w jednym zgłoszeniu."*

The preset detection (`detectPreset`) keeps its current heuristics (in `attendee-types-field.tsx`); only the labels change.

### Questions step composition (Step 9)

Three stacked blocks, each in its own card. Composition depends on the preset chosen at Step 5:

| Preset | Block 1 (per-attendee) | Block 2 (per-attendee, optional) | Block 3 (per-registration) |
|---|---|---|---|
| `jedna_osoba` | "Pytania o uczestnika" — *"Pojawią się w formularzu zapisu — np. rozmiar koszulki, dieta, alergie."* | — | "Pytania raz na całe zgłoszenie" — *"Pojawi się raz, niezależnie od liczby osób — np. „Skąd się dowiedziałaś?", uwagi, dane do faktury."* |
| `rodzic_z_dziecmi` | "Pytania o każde dziecko" — *"Pojawią się dla każdego dziecka osobno — np. wiek, alergie, dieta."* | "Pytania o rodzica (opcjonalne)" — *"Imię, email i telefon i tak są zbierane — pytaj tylko o coś dodatkowego, np. nr alarmowy."* | (same as above) |
| `grupa` | "Pytania o każdego uczestnika" — *"Pojawią się w formularzu zapisu dla każdej osoby w grupie — np. stanowisko, dieta."* | — | (same as above) |

Each block reuses `CustomQuestionsEditor`-style markup (the same "+ Dodaj pytanie" affordance, type chooser, ordering). Block 2 is *not* an accordion — it's just a card with `(opcjonalne)` next to the title.

Per-attendee blocks write into `attendeeType.customFields` for the relevant types. Per-registration writes into `event.customQuestions`. Existing schemas don't change.

### Validation per step

Each step's "Dalej" runs that step's Zod schema slice and PATCHes the draft. Errors render inline near the offending field; advancement is blocked. Required-to-advance fields (column above) gate the "Dalej" button: it remains enabled but on click returns `{ errors }` if validation fails. Skip-for-now is rendered only when the column says yes; clicking it sets `creationStep` to the next id without writing fields.

### Defaults

- Times: 9:00 / 17:00 (kept from current code).
- Preset: `jedna_osoba` ("Tylko siebie") preselected on Step 5.
- Platform consents auto-included on Step 10 (existing behavior).
- `balanceDueAt`: empty until checkbox enables it; no auto-default.

### Resume

`event.creationStep` is the source of truth. Dashboard event card shows a "Dokończ tworzenie" link iff that field is non-null. The link routes to `/dashboard/events/[id]?step=<creationStep>`.

`creationStep` is cleared (set to `null`) when the user clicks "Dalej" on Step 10 (Zgody) and lands on the post-wizard review. From that moment on the wizard is no longer the active flow for this event; the edit view is.

The wizard at `?step=…` honors the URL but redirects forward to `creationStep` if the user attempts to skip ahead past their current progress (no advancing past unfilled required steps via URL hacking). If `creationStep` is `null` and someone hits `?step=…`, the route redirects to the bare edit view (`/dashboard/events/[id]`).

## Final edit view (`/dashboard/events/[id]`)

Single page. Two columns on desktop, sticky header with bottom-sheet trigger on mobile.

### Desktop (≥sm)

Two-column layout. Left rail is sticky (~200px wide), pinned to the top of the viewport with a small offset for the page header. Main content scrolls independently when the rail is taller than the viewport.

Rail content (top → bottom):

```
Sekcje
─────────
✓ Podstawy
✓ Termin
✓ Miejsce
✓ Uczestnicy
✓ Liczba miejsc
✓ Płatność        (or "○ — wydarzenie darmowe" when free)
○ Zdjęcia
○ Pytania
✓ Zgody
─────────
[ Status: Szkic ]
[ Opublikuj ]   ← Stripe-aware
```

Each rail item is a `<button>` that smooth-scrolls to that section's anchor (`scrollIntoView({ block: "start" })`). Active section gets a coral left-border accent that updates as the user scrolls (IntersectionObserver tracking section visibility). The ✓/○ icon is computed from "this section's required fields are filled / has at least one entry".

The publish CTA at the rail's bottom is the same logic as the current header button — disabled with tooltip when Stripe isn't ready.

### Mobile (<sm)

Sticky top bar (replaces the rail):

```
[ ← Wydarzenie ]                    [ Sekcje ▾ ]
█████░░░░  5 z 9 sekcji wypełnionych
```

Tap "Sekcje ▾" → bottom sheet listing the same sections with status icons. Tap a section → sheet closes, page scrolls to that anchor. The publish CTA lives in the sticky bar on mobile (replacing the rail's button position).

### Section composition (top → bottom in main content)

1. **Banner** (post-wizard only): "✓ Wszystko gotowe — sprawdź szczegóły i kliknij **Opublikuj**" (or "Dokończ konfigurację Stripe, aby opublikować"). Dismissed on first publish or via explicit ×.
2. **Podstawy** — title, slug (with URL preview), description.
3. **Termin** — two independent date+time pickers (the same component used at Step 3).
4. **Miejsce** — location.
5. **Uczestnicy** — preset chooser + per-preset fields. **No questions here** (questions live in section 9).
6. **Liczba miejsc** — capacity with the "all participants count" helper text.
7. **Płatność** — checkbox + deposit/balance-due fields. Hidden entirely when event is free; rail item shows "○ — wydarzenie darmowe".
8. **Zdjęcia** — cover + gallery.
9. **Pytania w formularzu zapisu** — stacked sub-sections matching Step 9's composition.
10. **Zgody i regulaminy** — platform consents read-only at top + custom consents editor.

### Save model

Each section is its own `<form action={saveSectionAction}>` with a **Zapisz zmiany** button at the bottom of the section card and an inline "Zapisano" confirmation that fades after a few seconds. There is no global "save everything" button.

This avoids the current trap where a validation error in one section blocks saving an unrelated change in another. The publish CTA (rail / sticky bar) is independent of saves; it only enables when the full `eventBaseSchema` validates and Stripe is ready.

### Header

Above the banner: status badge + event title + view-switch (Edycja / Uczestnicy). Same content as today, just cleaner spacing. Publish/unpublish/archive controls move out of the header into the rail (desktop) or sticky bar (mobile) so the header stays a passive identity strip.

## State, persistence, edge cases

### Required-vs-optional matrix (drives ✓/○ + publish gate)

Required for publish: `title`, `slug`, `startsAt`, `endsAt` (with `endsAt > startsAt`), at least one attendee type with `priceCents ≥ 0`, `capacity ≥ 1`, plus Stripe ready (existing).

Optional: everything else. Their rail icons reflect "filled / not filled" as informational, not gating.

### Edge cases

- **Changing preset post-creation.** The current `applyPreset` flow keeps its `window.confirm("Zmienić szablon? Stracisz ustawione ceny i pytania.")` warning. Per-attendee `customFields` live inside the type, so they're naturally tied to the preset.
- **Free → paid mid-wizard.** If she's on Step 8 and goes back to Step 5 to add a price, on advancing forward the wizard inserts Step 7 (Płatność) before Step 8. Progress strip recomputes. `creationStep` stays consistent.
- **Capacity lowered below current registrations.** Edit-view-only concern. Server emits a non-blocking warning ("X osób już zapisanych — i tak chcesz?"). Existing `countTakenSpots` provides the count.
- **Browser back/forward in wizard.** Works naturally — each step has its own `?step=…`. Going back doesn't undo saved fields; it re-renders that step with seed values from the row.
- **Tab close mid-step.** "Dalej" is the save boundary. Anything typed after the last "Dalej" is lost. No autosave-on-blur.
- **Migration.** `event.creationStep` defaults to `null` for all existing rows. Existing events skip the wizard-completion path entirely (correct — they're already created).
- **Archived events.** Edit view stays accessible (existing `?status=archived` banner stays). Wizard is unreachable for archived/published events (`creationStep` is `null` or row status is `published`/`archived`).
- **URL hacking.** If `?step=` points past `creationStep`, the wizard redirects forward to `creationStep`. If it points behind (legitimate back-navigation), it's allowed.

### Validation philosophy

- **Per step (wizard)**: thin client validation (HTML `required` + small Zod slice for nice messages). Server is canonical. Required fields gate "Dalej"; optional fields validate only if non-empty.
- **Per section (edit view)**: same — section's slice is canonical; no cross-section validation at save time.
- **Publish gate**: full `eventBaseSchema.safeParse` of the row + Stripe-ready check. If validation fails, the publish CTA shows "Brakuje: <fields>" inline and scrolls to the first failing section.

### Accessibility

- Step transitions: focus moves to the new step's `<h1>`. `aria-live="polite"` on the progress strip (already in `WizardShell`).
- Mobile bottom sheet: focus-trapped while open, ESC closes, focus restored to the trigger button.
- Calendar popovers: existing `react-day-picker` accessibility intact, paired with each text input via `aria-controls`.
- Required-asterisk indicators: keep current convention (already addressed in recent commits).

## Out of scope

- Multi-organizer collaboration on draft creation.
- Autosave-on-blur (only "Dalej" / "Zapisz zmiany").
- Drag-and-drop reordering of sections.
- Template / "duplicate event" feature.
- Localization beyond Polish.
- Changes to the public registration form, payments, or Stripe integration.
- Changes to the participants tab.

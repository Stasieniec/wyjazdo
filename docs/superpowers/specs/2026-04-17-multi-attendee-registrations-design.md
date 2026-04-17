# Multi-Attendee Registrations — Design

**Date:** 2026-04-17
**Status:** Draft (pending user review)

## Problem

Today's registration model is 1 registration = 1 attendee = 1 price. Real-world use cases require one registrant to sign up multiple people with variable pricing:

- **Mama i dziecko** (first client): parent registers themselves + 1..N children. First child costs one price, additional children cost less.
- **Group/team registration**: one person signs up several colleagues.
- **Couples**, **family passes**, **age-tiered pricing**, etc.

Each attendee may need its own set of custom fields (age, allergies, dietary restrictions). Every attendee counts toward event capacity.

## Constraints

- **Organizer persona**: non-technical women aged 40–50 who chose Wyjazdo *because* existing platforms (Eventbrite-like) were too complex. They were coming from Google Forms. The default UX must stay near Google-Forms simplicity.
- **Platform flexibility**: we can't hardcode "Mama i dziecko." Different organizers will want different shapes (groups, couples, age tiers). The model must generalize without exposing that generality in the default UI.
- **Backward compatibility**: existing events and their current flows must keep working unchanged.

## Approach: Attendee Types with Preset-Driven UX

One underlying primitive — **attendee types** (name, qty range, price, graduated pricing, per-attendee custom fields) — exposed via **presets** that pre-fill sensible configurations. Organizers pick a familiar scenario ("Rodzic z dziećmi," "Grupa / zespół," "Jedna osoba") and just fill in prices. Power users can open a "Własna konfiguracja" editor to edit attendee types directly.

This avoids both traps:

- **Pure Eventbrite-style ticket types** pushes configuration complexity onto the organizer — the exact thing they fled.
- **Hardcoded templates** creates endless "add a new template" work as new use cases appear.

Presets are not hardcoded code paths — they populate the same underlying `attendeeTypes` data. Registration, pricing, capacity, and payment logic are uniform regardless of which preset was used.

## Data Model

### New: `attendeeTypes` JSON column on `events`

Stored as a JSON array on the event, same pattern as the existing `customQuestions` column.

```ts
type AttendeeType = {
  id: string;           // ulid, stable identifier
  name: string;         // "Rodzic", "Dziecko", "Uczestnik"
  minQty: number;       // minimum attendees of this type per registration
  maxQty: number;       // maximum attendees of this type per registration
  priceCents: number;   // base price per attendee
  graduatedPricing?: Array<{
    fromQty: number;    // starting from which attendee of this type (2 = 2nd onwards)
    priceCents: number; // price for attendees from that position onwards
  }>;
  customFields?: Array<{
    id: string;
    label: string;
    type: "text" | "long_text" | "select" | "number" | "date";
    required: boolean;
    options?: string[]; // for "select"
  }>;
};
```

**Example — Mama i dziecko:**

```json
[
  {
    "id": "01J...A",
    "name": "Rodzic",
    "minQty": 1,
    "maxQty": 1,
    "priceCents": 20000,
    "customFields": []
  },
  {
    "id": "01J...B",
    "name": "Dziecko",
    "minQty": 1,
    "maxQty": 5,
    "priceCents": 10000,
    "graduatedPricing": [{ "fromQty": 2, "priceCents": 8000 }],
    "customFields": [
      { "id": "01J...C", "label": "Wiek", "type": "number", "required": true },
      { "id": "01J...D", "label": "Alergie", "type": "text", "required": false }
    ]
  }
]
```

### New: `attendees` table

```
attendees
  id              text PK
  participantId   text FK → participants (CASCADE)
  attendeeTypeId  text (references AttendeeType.id in event's attendeeTypes JSON)
  firstName       text
  lastName        text
  customAnswers   text (JSON, keyed by customField.id)
  cancelledAt     integer (nullable; soft-delete for audit trail)
  createdAt       integer
```

Index: `(participantId)` for fast lookup of all attendees in a registration, and `(cancelledAt)` to efficiently filter active attendees.

### Changes to existing tables

- **`events`**: add `attendeeTypes` (text, JSON). Nullable to support legacy events.
- **`participants`**: conceptually becomes the "registrant" (payer + contact + consent holder). No schema change. The `firstName`/`lastName`/`email`/`phone` fields describe the registrant. Per-attendee identity moves to `attendees`.
- **`payments`**: no change. Still linked to `participants`. One registrant → one payment trail (full, or deposit + balance).
- **`participantConsents`**: no change. Consents are held by the registrant.

### Backward compatibility

Events without `attendeeTypes` (legacy, or explicitly the "Jedna osoba" preset) are treated as having a single implicit attendee type: `{ minQty: 1, maxQty: 1, priceCents: event.priceCents, name: "Uczestnik" }`. The `participants` row is both the registrant and the sole attendee. No `attendees` rows are required for these events.

New events always write `attendeeTypes` even when the preset is "Jedna osoba" — this unifies the read path over time. Migration of existing events is not required; they continue to work via the legacy path.

## Pricing Engine

One shared pure function, used by both client (live preview) and server (authoritative calculation).

```ts
function calculateTotal(
  attendeeTypes: AttendeeType[],
  quantities: Record<string /* attendeeTypeId */, number>
): { perType: Array<{ typeId: string; subtotal: number; breakdown: Array<{position: number, priceCents: number}> }>; total: number };
```

**Algorithm (per attendee type):**

1. Sort `graduatedPricing` by `fromQty` descending.
2. For each attendee position 1..qty:
   - Find the first tier where `fromQty <= position`. If found, use that `priceCents`; else use the base `priceCents`.
3. Sum per-attendee prices.

**Example — 1 parent + 3 children:**

| Attendee | Type | Position | Price rule | PLN |
|---|---|---|---|---|
| 1 | Rodzic | 1 | base | 200 |
| 2 | Dziecko | 1 | base | 100 |
| 3 | Dziecko | 2 | tier fromQty=2 | 80 |
| 4 | Dziecko | 3 | tier fromQty=2 | 80 |
| | | | **Total** | **460** |

**Server-side:** `processRegistration` recalculates the total from scratch using the submitted quantities and the event's `attendeeTypes`. The client-submitted total is never trusted.

### Deposit mode (unchanged semantics)

Deposit remains a **flat amount at the registration level**, set by the organizer per event. Deposit is independent of attendee types.

- Balance = max(0, `total - depositCents`).
- If `depositCents >= total` (e.g., organizer set a 200 PLN deposit but a registration comes in at 100 PLN total), the registration is treated as fully paid by the deposit. No balance payment created.
- If attendees are modified after deposit has been paid but before balance is due, the balance is recalculated against the new total. The deposit itself is not modified.

## Organizer UX — Event Configuration

### The "Kto bierze udział?" section

Added to the event create/edit form after basic details (title, date, location). Presented as selectable cards:

1. **Jedna osoba** — "Standardowa rejestracja, jedna osoba na zgłoszenie" (default; identical to current behavior)
2. **Rodzic z dziećmi** — "Rodzic zapisuje siebie i swoje dzieci"
3. **Grupa / zespół** — "Jedna osoba zapisuje kilku uczestników"

Plus a subtle text link: `Potrzebujesz innej konfiguracji? Utwórz własną →`.

### Preset → data mapping

**Jedna osoba**: one attendee type `{ name: "Uczestnik", minQty: 1, maxQty: 1, priceCents: <event price> }`. The organizer sees only a single "Cena" input — no mention of attendee types. Equivalent to today's UX.

**Rodzic z dziećmi**: two attendee types pre-filled:
- `{ name: "Rodzic", minQty: 1, maxQty: 1 }` — organizer fills in `priceCents`.
- `{ name: "Dziecko", minQty: 1, maxQty: 5 }` — organizer fills in `priceCents`. Toggle "Zniżka dla kolejnych dzieci" reveals graduated pricing inputs (`fromQty` + discounted `priceCents`). Default suggestion: from 2nd child onwards.

**Grupa / zespół**: one attendee type `{ name: "Uczestnik", minQty: 1, maxQty: 10 }`. Organizer sets price. Optional bulk discount toggle mirrors the graduated pricing control.

**Własna konfiguracja**: opens the raw attendee-types editor (add/remove types, set name/qty/price/graduated pricing, manage custom fields per type). This is the "Eventbrite-style" path and is deliberately out of the default flow.

### Custom fields per attendee type

Each attendee type has:
- **Built-in required fields:** `firstName`, `lastName`. Always collected.
- **Configurable custom fields:** Reuses the existing custom-fields editor pattern from `customQuestions`. Per-type suggestions:
  - "Dziecko" preset: `Wiek` (number, required) prefilled.
  - Organizer can add `Alergie`, `Dieta`, etc.

### Per-registration questions (existing `customQuestions`)

Remain as registration-level questions that apply to the whole group ("Jak dowiedziałaś się o wydarzeniu?", "Uwagi dodatkowe"). This is a natural split:

- **`customQuestions`** on event → about the registration.
- **`customFields`** on attendee type → about each attendee.

## Registrant UX — Registration Form

### Structure

```
┌─ Twoje dane ─────────────────────────────────────────┐
│  Registrant fields + (if applicable) the built-in    │
│  attendee-type-0 fields appended here, so the        │
│  registrant isn't asked their name twice.            │
└──────────────────────────────────────────────────────┘

┌─ <Type name> <N> ────────────────────────────────────┐
│  Per-attendee form (firstName, lastName, custom      │
│  fields). One card per attendee beyond the           │
│  registrant.                                         │
└──────────────────────────────────────────────────────┘

[+ Dodaj <type name>]   (shown when current count < maxQty)

┌─ Dodatkowe informacje ───────────────────────────────┐
│  Event-level customQuestions (unchanged).            │
└──────────────────────────────────────────────────────┘

┌─ Podsumowanie ───────────────────────────────────────┐
│  Live breakdown: each attendee + price, then total.  │
│  Deposit info if applicable.                         │
└──────────────────────────────────────────────────────┘

┌─ Zgody ──────────────────────────────────────────────┐
│  (unchanged)                                         │
└──────────────────────────────────────────────────────┘

[Zapisz się i zapłać — <total> PLN]
```

### Key behaviors

- **The registrant is always also the first attendee.** All presets assume the person filling the form is attending. For "Rodzic z dziećmi," the form collects registrant email/phone alongside the parent's name/custom fields, treating the registrant as the Rodzic — no duplicate name fields. A "coordinator who isn't attending" scenario is not supported by the presets and is **out of scope** for this iteration; an organizer who needs it must model it via Własna konfiguracja and handle the coordinator out-of-band.
- **"Jedna osoba" events look identical to today.** Only one attendee (the registrant themselves), no "+ Dodaj" buttons, no summary table — the existing simple form.
- **Adding/removing attendees.** "+ Dodaj <name>" appears when count < maxQty. Each added attendee gets a collapsible card with a remove button (visible when count > minQty). Live price summary.
- **Capacity awareness.** On form load, remaining capacity is fetched. The "+ Dodaj" button is disabled with an inline message when adding would exceed remaining spots: "Pozostały tylko N wolnych miejsc."
- **Validation.** Each attendee card validates independently (required fields per attendee type). Submit is blocked until all cards pass.

### Confirmation emails & "Moje wyjazdy"

The registrant's confirmation email and self-serve "Moje wyjazdy" page list every attendee in the registration so the registrant sees exactly who they signed up for.

## Cancellation, Refunds & Deposits

### Payment scope

Payments stay at the **registration level**. One Stripe Checkout charges the registrant the full total (or flat deposit). Refunds are issued at the registration level; we don't split one Stripe payment into per-attendee charges.

### Two cancellation levels

**1. Whole registration cancellation** (organizer action; unchanged mechanics)
- Sets `participants.lifecycleStatus = "cancelled"`.
- Frees all attendees' spots from capacity.
- Refund is suggested in the UI but requires an explicit organizer click.

**2. Per-attendee removal** (organizer action; new)
- Sets `attendees.cancelledAt = now()` (soft-delete for audit).
- Frees that single spot.
- Recomputes the registration's new total from remaining active attendees.
- Displays a suggested refund: `previousPaidAmount - newTotal`, capped at 0 (never negative). Organizer decides whether to issue it.

Self-service attendee removal by the registrant is **out of scope for this iteration.** Attendee changes go through the organizer, matching today's out-of-band client communication patterns.

### Deposits with multiple attendees

- Deposit is a flat amount at registration level (no per-type deposits).
- Deposit is charged in full at registration time regardless of attendee count.
- Balance payment amount = `newTotal - depositCents`, recalculated if attendees change before balance payment is created/paid.
- If `depositCents >= total`, no balance payment is created.
- Edge case — deposit already paid, attendees removed such that new total < deposit: the deposit already covers everything. No balance payment. Any excess is at the organizer's discretion via a manual refund.

### UI — group visibility on the participant list

The dashboard participant list groups attendees under their registrant. Each registration is expandable and shows a count badge when it has >1 attendee:

```
▼ Kowalska Anna  (anna@example.com)      3 osoby   380 PLN   Opłacone
    ├─ Anna Kowalska          Rodzic
    ├─ Jaś Kowalski           Dziecko  (wiek: 5)
    └─ Zosia Kowalska         Dziecko  (wiek: 3)

▼ Nowak Marta  (marta@example.com)       1 osoba   200 PLN   Zaliczka
    └─ Marta Nowak            Uczestnik
```

Single-attendee registrations render like today (no expandable affordance, no count badge).

### UI — warnings on removal

**Remove a single attendee from a group:**

> **Usunąć Jasia Kowalskiego z zgłoszenia?**
>
> Jaś jest częścią zgłoszenia **Anny Kowalskiej** (3 osoby łącznie). Po usunięciu:
> - Zgłoszenie będzie zawierać 2 osoby (Anna + Zosia)
> - Nowa cena: **300 PLN** (było 380 PLN)
> - Sugerowany zwrot: **80 PLN**
> - Zwolni się 1 miejsce (pozostało wolnych: 5)
>
> Zwrot nie zostanie wykonany automatycznie — wykonasz go ręcznie po potwierdzeniu.
>
> [Anuluj]   [Usuń uczestnika]

**Cancel a whole group registration:**

> **Anulować zgłoszenie Anny Kowalskiej?**
>
> To usunie wszystkie 3 osoby z wydarzenia:
> - Anna Kowalska (Rodzic)
> - Jaś Kowalski (Dziecko)
> - Zosia Kowalska (Dziecko)
>
> Zwolni się 3 miejsca. Sugerowany zwrot: **380 PLN**.
>
> [Anuluj]   [Anuluj zgłoszenie]

## Capacity

The existing `countTakenSpots(eventId)` helper (in `lib/capacity.ts`) today returns the number of participants considered "taken" — those with `lifecycleStatus = "active"` and a non-expired payment in {pending, deposit_paid, paid, overdue}.

With multi-attendee registrations, the helper changes: instead of counting participants, it counts **active (non-cancelled) attendee rows** belonging to participants that would have been counted under the current logic.

```
takenSpots =
  sum over participants P where P qualifies under existing "taken" rules:
    count of attendees A where A.participantId = P.id AND A.cancelledAt IS NULL
```

**Legacy events** (no `attendeeTypes` on the event, no `attendees` rows) fall back to the current behavior — one qualifying participant = one spot — via the implicit-single-type path.

The registration form and server both check capacity against remaining spots before allowing an attendee count to be submitted.

## Out of Scope (this iteration)

- **Self-service attendee add/remove** by the registrant after registration.
- **Automatic refunds** — always organizer-initiated.
- **Per-attendee-type deposits.**
- **Percentage-based deposits** (still flat amount).
- **Discount codes / coupons.**
- **Waitlist promotion for groups** (today's waitlist flow continues to operate per registration; group-aware promotion is a follow-up).
- **Event-level currency other than PLN.**

## Migration

- Schema migration: add `attendeeTypes` column to `events` (nullable); create `attendees` table with its index.
- **No data migration required.** Legacy events without `attendeeTypes` use the implicit-single-type fallback path at read time. New events always write `attendeeTypes`.

## Success Criteria

- An organizer can create a "Mama i dziecko" event via the "Rodzic z dziećmi" preset, set prices, and publish without touching attendee-type internals.
- A parent can register themselves + 1..5 children, each with their own name/age/allergies, see the price update live, and pay via Stripe.
- Capacity correctly deducts every attendee.
- The organizer dashboard shows each registration as a group, with per-attendee rows and clear count badges.
- Removing a single attendee shows a confirmation dialog with the group context, new total, and suggested refund. Removing the whole registration lists all affected attendees.
- Existing events and their registrations continue to function without modification.
- The "Jedna osoba" preset produces a UX indistinguishable from the current single-person flow (both for organizer and registrant).

# Wyjazdo Design Overhaul Pass 2 — Spec

## Context

Pass 1 redesigned the dashboard (sidebar, overview, events list) and landing page. This pass applies the same design system to all remaining pages and components that still use old styling patterns (hardcoded `bg-black` buttons, `text-neutral-*` colors, missing shadows/radius).

**Design system (established in Pass 1):**
- Colors: Navy `#1E3A5F`, Coral `#E8683A`, via CSS variables
- Radius: `rounded-xl` for cards, `rounded-lg` for inputs/buttons
- Shadows: `shadow-sm` on cards, `shadow-[--shadow-warm]` on coral CTAs
- Transitions: `transition-all duration-150` on interactive elements
- Typography: IBM Plex Sans, consistent heading pattern (`text-xl font-bold sm:text-2xl`)

## 1. My-Trips Pages (Participant-Facing)

These are the pages participants see. Currently they use hardcoded `bg-black` buttons and `text-neutral-*` colors — completely disconnected from the design system.

### `/my-trips` — Trip list
- Replace `max-w-2xl mx-auto p-8` with `max-w-2xl mx-auto px-4 py-8 sm:px-6`
- Replace `text-neutral-600` with `text-muted-foreground`
- Replace `text-neutral-500` with `text-muted-foreground`
- Replace bare `rounded border p-4` list items with Card component (padding="sm")
- Add nav header with Wyjazdo logo linking to `/`
- Heading: `text-xl font-bold sm:text-2xl`

### `/my-trips/[id]` — Trip detail
- Same container fix as above
- Replace `text-neutral-600` → `text-muted-foreground`
- Replace `text-neutral-500` → `text-muted-foreground`
- Replace `rounded border p-4` payment section with Card component
- **Replace hardcoded black button** (`bg-black px-4 py-2 text-white font-medium hover:bg-neutral-800`) with `rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90`
- Add heading consistency

### `/my-trips/request-link` — Magic link page
- Same container fix
- Replace error alert (`border-red-300 bg-red-50 text-red-800`) with `rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive`
- Replace success alert (`border-green-300 bg-green-50 text-green-800`) with `rounded-xl border border-success/40 bg-success/5 p-4 text-sm text-success`
- Replace bare `rounded border px-3 py-2` input with proper Input styling: `w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`
- **Replace hardcoded black button** with coral accent button (same pattern as above)
- Add Wyjazdo logo header

## 2. Onboarding Payouts Pages

### `/dashboard/onboarding/payouts`
- Heading: `text-xl font-bold sm:text-2xl`
- Body text: add `text-muted-foreground` 
- **Replace hardcoded black button** with coral accent: `rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90`

### `/dashboard/onboarding/payouts/return`
- Same heading fix
- Same button replacement
- Style the "Wróć do panelu" link with `text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground`

## 3. TimePickerSelects Component

Replace all hardcoded neutral colors:
- `text-neutral-500` → `text-muted-foreground`
- `text-neutral-900` → `text-foreground`
- `text-neutral-400` → `text-muted-foreground`
- `focus:border-neutral-900` → `focus:border-ring`
- `focus:ring-neutral-500/25` → `focus:ring-ring/25`
- `disabled:bg-neutral-100` → `disabled:bg-muted`
- `disabled:text-neutral-400` → `disabled:text-muted-foreground`
- SelectChevron: `text-neutral-500` → `text-muted-foreground`
- Colon separator: `text-neutral-400` → `text-muted-foreground`
- Add `border-border` to select elements (currently just `border`)

## 4. ParticipantsTable — Status Badge Colors

Replace the `statusColor` function with design-system-aligned colors:
- `paid` → `bg-success/10 text-success`
- `deposit_paid` → `bg-success/10 text-success`
- `overdue` → `bg-amber-50 text-amber-700`
- `pending` → `bg-amber-50 text-amber-700`
- `waitlisted` → `bg-primary/10 text-primary`
- `cancelled` → `bg-muted text-muted-foreground`
- `refunded` → `bg-destructive/10 text-destructive`

These match the existing Badge component variants (success, warning, info, default, destructive).

## 5. Public Event Pages (Light Polish)

### `/sites/[subdomain]/[eventSlug]` — Event page
- Already well-structured with `--brand` CSS variable
- Update any `rounded-lg` on info cards to `rounded-xl`
- Add `shadow-sm` to info card sections

### `/sites/[subdomain]` — Organizer profile
- Same radius updates where applicable
- These pages use organizer's `brandColor` as a CSS variable — this is correct and should stay

## 6. Scope

### In scope
1. My-trips pages (3 pages)
2. Onboarding payouts pages (2 pages)
3. TimePickerSelects component
4. ParticipantsTable status colors
5. Public event page radius/shadow polish

### Out of scope
- Email templates (already using correct colors)
- Auth pages (Clerk-managed)
- Legal pages (prose styling is fine)
- Event create/edit pages (already using new components)
- SubmitButton (already delegates to Button component)

### Implementation order
1. TimePickerSelects (unblocks other components)
2. ParticipantsTable status colors
3. My-trips pages (3 pages)
4. Onboarding payouts pages (2 pages)
5. Public event page polish

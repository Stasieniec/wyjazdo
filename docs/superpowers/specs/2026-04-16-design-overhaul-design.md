# Wyjazdo Design Overhaul — Spec

## Context

Wyjazdo is a SaaS for solo trip organizers (primarily women aged 40-50) managing 3-20 group events. The current UI is functional but visually basic. This spec defines a design overhaul that makes the app bold and energetic while remaining simple and self-explanatory — the design does the heavy lifting so the user doesn't have to.

**Target user:** Solo organizer, not deeply technical, needs to feel comfortable immediately. No hidden menus, no ambiguous icons without labels, no "you should just know" patterns.

**Visual personality:** Bold & energetic. Navy (#1E3A5F) and coral (#E8683A) play equal roles. Strong visual hierarchy guides the eye naturally. Professional but not corporate.

## 1. Design System Refinements

### Keep unchanged
- **Colors:** Navy `#1E3A5F` (primary), Coral `#E8683A` (accent), Success `#059669`, Destructive `#DC2626`, Background `#FAFAFA`, Foreground `#111827`, Muted `#F4F4F5`, Border `#E5E7EB`
- **Typography:** IBM Plex Sans (400, 500, 600, 700), IBM Plex Mono (400, 500)
- **Light-only** — no dark mode
- **Existing CSS variable system** in `globals.css` via `@theme`

### Standardize border radius
- `rounded-xl` (0.75rem) — cards, panels, modals, dashboard stat cards
- `rounded-lg` (0.5rem) — inputs, buttons, smaller interactive elements
- `rounded-full` — avatars, status dots, badge pills

### Add shadow system
- Cards at rest: `shadow-sm` (subtle lift off background)
- Cards on hover: `shadow-md` (interactive feedback)
- CTA buttons (coral): `box-shadow: 0 2px 8px rgba(232, 104, 58, 0.3)` (warm glow)
- Dashboard screenshot on landing: `box-shadow: 0 8px 40px rgba(30, 58, 95, 0.25)` (dramatic lift)

### Button refinements
- Primary (coral) CTA: Gets warm shadow, `transition-all duration-150`
- All interactive elements (buttons, cards, sidebar items): Add `transition-all duration-150` for hover/active states
- No other button changes — existing variants (primary, accent, secondary, ghost, destructive) and sizes (sm, md, lg) stay

### Signature pattern: Navy gradient card
- `background: linear-gradient(135deg, #1E3A5F, #2d5a8a)`
- White text, `rounded-xl`, used for hero stats
- This is a reusable pattern across dashboard and landing page

### What NOT to add
- Dark mode
- Complex animations or motion libraries
- New colors outside existing palette
- New font families
- Extra dependencies

## 2. Dashboard Redesign

### Layout: Sidebar + Content

**Sidebar (expanded — default on desktop):**
- Width: 220px
- Background: `#1E3A5F` (navy)
- Logo + "Wyjazdo" text at top
- Navigation items with SVG icons + text labels
- Active item: `background: rgba(255,255,255,0.12)`, `border-left: 3px solid #E8683A`, font-weight 600
- Inactive items: `color: rgba(255,255,255,0.6)`, `border-left: 3px solid transparent`
- "Zwiń panel" collapse toggle at bottom of nav section
- User avatar (coral gradient initial) + name + email at very bottom, above border-top separator

**Sidebar (collapsed):**
- Width: 64px
- Icon-only, same navy background
- Logo mark only (no text)
- Same active/inactive states via border-left and opacity
- Expand chevron button
- Avatar only (no name/email)

**Navigation items (4 total):**
1. Przegląd → `/dashboard` (new overview page)
2. Wydarzenia → `/dashboard/events` (existing, restyled)
3. Finanse → `/dashboard/finance` (existing, styling pass)
4. Ustawienia → `/dashboard/settings` (existing, styling pass)

**Content area:**
- Background: `#FAFAFA`
- Padding: 24px
- No max-width constraint — fills remaining space

### Mobile behavior
- Sidebar becomes a **bottom tab bar** on screens below `sm` (640px)
- 4 icons with labels underneath (Przegląd, Wydarzenia, Finanse, Ustawienia)
- No hamburger menu, no slide-out drawer
- Content stacks vertically, stat cards go single column

### New page: Przegląd (Overview)

**Header row:**
- "Dzień dobry, [name] 👋" greeting
- Date below in muted text
- "+ Nowe wydarzenie" coral CTA button (top right)

**Bento stats row (3 cards in a grid):**
- **Przychód** — navy gradient card, large number, percentage change badge
- **Aktywne wydarzenia** — white card with border, count + "X w tym miesiącu" subtitle
- **Najbliższe wydarzenie** — white card with border, event name + "za X dni · Y/Z miejsc"
- Grid layout: `grid-cols-2` with Przychód spanning both columns when sidebar is expanded; `grid-cols-3` (all equal) when sidebar is collapsed and more horizontal space is available. On mobile: single column stack.

**Wymaga uwagi (action items list):**
- Section heading: "Wymaga uwagi", font-weight 600
- White card with `rounded-xl`, border
- Each item is a row: colored severity dot (coral = urgent, amber = attention, green = positive) + event name (bold) + description (muted) + "Sprawdź →" link (coral) or "Gotowe ✓" (muted)
- Rows separated by light border (`#F3F4F6`)

**Ostatnia aktywność (recent activity feed):**
- Lightweight list below action items
- Each row: small colored dot + description with participant name bolded + relative timestamp (right-aligned, muted)
- No card wrapper — just a simple list to keep it light

### Wydarzenia page refresh
- Event cards get: date blocks (navy gradient square with month abbreviation + day), status badges (colored pills matching existing Badge component), capacity indicator
- Each card: white background, `rounded-xl`, `border`, `shadow-sm`, hover `shadow-md`
- Layout: vertical stack with gap-8

### Finanse + Ustawienia
- Lighter styling pass only — apply new card styles, consistent border-radius, shadow system, sidebar layout
- No layout redesign

## 3. Landing Page Redesign

### Approach: "Clean Reveal"
White background hero with centered text, then the dashboard screenshot takes over as the primary visual. The product speaks for itself.

**All text in Polish.**

### Section 1: Navigation bar
- Sticky, white background, subtle bottom border
- Logo + "Wyjazdo" left
- "Zaloguj się" (text link) + "Wypróbuj za darmo" (navy button) right
- Same nav component as current, restyled

### Section 2: Hero
- Centered layout, white/light background
- Subtitle above headline: "Dla organizatorów wyjazdów grupowych" (coral, uppercase, small, letter-spaced)
- Headline: "Organizujesz wyjazdy?" + line break + "My ogarniamy resztę." (coral span)
- Body text: "Zapisy, płatności, uczestnicy — jedno narzędzie zamiast dziesięciu arkuszy." (muted)
- CTA: "Zacznij za darmo →" (coral button with warm shadow)
- Sub-CTA text: "Bez karty kredytowej · Gotowe w 5 minut" (small, muted)

### Section 3: Dashboard screenshot
- Full-width (with side padding) browser frame mockup
- Navy outer frame with browser chrome dots + address bar showing `app.wyjazdo.pl/dashboard`
- Inside: the actual dashboard with sidebar, stats, action items, activity feed — all with dummy data
- Shadow: `0 8px 40px rgba(30, 58, 95, 0.25)` for dramatic lift
- **Implementation note:** This should be a real screenshot or carefully styled static HTML that matches the dashboard. Update it when the dashboard changes.

### Section 4: Trust line
- Simple centered text: "Już ponad **200 wyjazdów** zorganizowanych z Wyjazdo"
- Light separator between screenshot and benefits

### Section 5: Benefits (3 cards)
- Horizontal row on desktop, vertical stack on mobile
- Each card: coral-tinted icon background (`#FEF2ED`), coral SVG icon, bold title, short description
- Cards:
  1. **Formularz zapisów** — "Uczestnicy zapisują się sami. Ty dostajesz powiadomienie."
  2. **Automatyczne płatności** — "Linki do płatności wysyłają się same. Koniec z pilnowaniem przelewów."
  3. **Pełen obraz** — "Kto zapłacił, kto nie, kto czeka — wszystko w jednym widoku."

### Section 6: Testimonial
- Single quote from one organizer (not a carousel)
- Large quote text, name + context below
- Subtle background or card treatment

### Section 7: CTA band
- Full-width navy background with dot-grid texture overlay + coral glow (right side) — borrowed from approach B
- Bold white headline + coral CTA button
- Strong visual closer that contrasts with the clean white above

### Section 8: Footer
- Minimal: logo, legal links (Regulamin, Polityka prywatności), contact
- No giant footer grid

### Mobile landing page
- Hero text stays centered, CTA stays prominent
- Dashboard screenshot scales down proportionally, remains visible (not hidden)
- Benefits stack to single column
- Navy CTA band stays full-width
- Footer stays minimal

## 4. Scope & Priorities

### In scope (this design overhaul)
1. New dashboard sidebar layout (expandable/collapsible) + mobile bottom tab bar
2. New Przegląd (overview) page
3. Wydarzenia page visual refresh (card redesign)
4. Finanse + Ustawienia styling pass
5. Landing page full redesign
6. Design system refinements (radius, shadows, transitions, button polish)
7. Component updates (Card, Button, Badge, Input — to match new system)

### Out of scope (future work)
- Other pages (my-trips, public event pages, registration, onboarding)
- Email template redesign
- Dark mode
- New functionality — this is a visual overhaul only
- Participant-facing pages (sites/[subdomain]/*)

### Implementation order
1. Design system refinements (globals.css, component updates)
2. Dashboard sidebar layout + mobile bottom tab bar
3. Przegląd (overview) page
4. Wydarzenia page refresh
5. Finanse + Ustawienia styling pass
6. Landing page redesign

This order ensures the dashboard looks polished before we create the landing page screenshot.

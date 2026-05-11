# `/pomoc` — Docs & help section

**Status:** Design approved 2026-05-11 — ready for implementation plan.

## Goal

Add a Polish-language help section at `/pomoc` that:

1. Explains what Wyjazdo is and how it works (organizer-facing).
2. Walks an organizer through every part of the product she'll touch.
3. Is comprehensive but minimal — short, scannable pages in plain Polish, written for a woman ~40–50 who is non-technical and came from Google Forms / spreadsheets.
4. Earns SEO surface for organizer-intent queries (`co to jest wyjazdo`, `ile kosztuje wyjazdo`, `jak zorganizować wyjazd online`, etc.).
5. Is reachable from both the marketing landing and the dashboard.

## Non-goals

- No content management UI. Pages are TSX; updates are git commits.
- No screenshots. Text + inline SVG icons only.
- No i18n machinery. Polish only, hard-coded.
- No search. Eight pages don't need it — a hub card grid is sufficient.
- No video or animation.
- No new analytics events added specifically for docs.
- No A/B testing of help content.
- No participant-facing help. Audience is organizers only.

## Audience

Organizer persona (per user memory): non-technical women 40–50, came from Google Forms, need readable affordances (no `text-xs` for actions) and defaults that work without configuration. All money is in **PLN, not grosze**.

Both prospects (`/pomoc/co-to-jest`, `/pomoc/cennik`) and existing users (`/pomoc/tworzenie-wydarzenia`, `/pomoc/platnosci`) are served by the same hub.

## Information architecture

```
/pomoc                          — hub: intro + card grid
  /co-to-jest                   — "Co to jest Wyjazdo i jak działa"
  /jak-zaczac                   — sign-up, onboarding, subdomena, pierwsze logowanie
  /tworzenie-wydarzenia         — the 10-step event wizard walkthrough
  /platnosci                    — Stripe setup, BLIK/Przelewy24/karta, prowizje, wypłaty
  /uczestnicy                   — lista, statusy, anulowanie, eksport, własne pytania
  /promocja                     — link, subdomena, podgląd OG na FB/IG
  /cennik                       — ile kosztuje Wyjazdo, prowizje Stripe
  /faq                          — short answers + Schema.org FAQPage markup
```

URL convention chosen: `/pomoc` (Polish SaaS convention for "help"). Slugs are Polish, lowercase, hyphen-separated, kept short.

## Page architecture & layout

### New route segment

`src/app/pomoc/` — its own top-level segment, separate from `(legal)`. Reason: legal layout is intentionally bare with no chrome; docs need their own nav and a richer hub layout.

### `src/app/pomoc/layout.tsx`

Shared chrome for all docs pages:

- Slim top nav: `WyjazdoMark` + "wyjazdo" wordmark on the left (links to `/`).
- Auth-aware right side using Clerk `<Show>`:
  - Signed-out: `Zaloguj się` link + `Wypróbuj za darmo` primary CTA (same as landing).
  - Signed-in: `Panel organizatora` button + `UserMenu`.
- Below the nav: docs content (children).
- A minimal footer line: `Wróć do strony głównej →` link + `Kontakt: kontakt@wyjazdo.pl`.

### `src/app/pomoc/page.tsx` (hub)

Wider container than the topic pages (cards need width). Structure:

```
H1 — "Jak korzystać z Wyjazdo"
Lead (2 sentences, no fluff)

[ Co to jest Wyjazdo i jak działa ]   ← wide intro card (col-span-2 on desktop)

[Jak zacząć]   [Tworzenie         ]   [Płatności       ]
                wydarzenia                 i wypłaty

[Uczestnicy]   [Promocja          ]   [Cennik            ]
                i udostępnianie

[FAQ — najczęstsze pytania]           ← full-width card

Kontakt: kontakt@wyjazdo.pl           ← one line, no card
```

Each card: small icon (reuse landing-benefits SVG style), title, 1-line description. Whole card is the link (no `→` arrow inside).

### Topic pages — `src/app/pomoc/<slug>/page.tsx`

Each one follows the same shape:

```
<DocsArticle>
  H1 — page title (matches dashboard terminology so it's findable)
  Lead paragraph (1–2 sentences, plain Polish)

  H2 sections — 3–5 of them, each self-contained
    – Short paragraphs (3–4 lines max)
    – Numbered lists for step-by-step
    – <Callout> boxes for "Uwaga" / "Wskazówka"
    – Inline links to dashboard routes for signed-in readers
       (e.g. /dashboard/events/new, /dashboard/onboarding/payouts)

  <RelatedTopics /> — 2–3 cards to sibling topics
</DocsArticle>
```

## Components

```
src/components/docs/
  DocsArticle.tsx     — narrow reading column, H1, last-updated, prose slot
  DocsNav.tsx         — slim top nav (auth-aware; reuses <Show> + WyjazdoMark)
                        (may live inline in layout.tsx if simpler)
  DocsCard.tsx        — card used on hub + RelatedTopics
  Callout.tsx         — "Uwaga" / "Wskazówka" boxes with warm tip styling
  RelatedTopics.tsx   — renders 2–3 DocsCards based on the current topic's `related` list

src/lib/docs/
  topics.ts           — single source of truth: { slug, title, blurb, icon, related[] }
                        for all 8 topics. Imported by the hub, RelatedTopics, sitemap.ts,
                        and each page's metadata. Keeps cross-links + SEO in sync.
```

### Why a single `topics.ts`

Cross-linking, hub cards, related-topics footer, and sitemap entries all need the same slug/title/blurb metadata. Centralising prevents drift (e.g. renaming a slug only in one place).

## Content & tone rules

Drawn from the organizer-persona memory and the existing dashboard copy:

- **Direct address, feminine singular:** *"zobaczysz", "kliknij", "wprowadź"*.
- **No English jargon.**
  - `subdomena` — define once per page on first use.
  - `Stripe` — name it (it appears on her invoice) but describe as *"nasz operator płatności"*.
- **Money in PLN, never grosze.** Even when explaining Stripe fees, show *"39 zł"* / *"1,5% + 1 zł"* format.
- **Match dashboard nouns exactly:** *Przegląd / Wydarzenia / Finanse / Ustawienia / Uczestniczki / Wypłaty*. The docs are a map between Polish words and dashboard buttons.
- **No emojis in body** (only as small section icons, sparingly).
- **Affordances:**
  - All inline links ≥ `text-sm` and underlined.
  - `Callout` boxes are full-width with clear borders.
  - Numbered list markers are large and accent-coloured, not muted.

## SEO

### Per-page metadata

Each page exports a `Metadata` object with:

- `title` — specific phrase, ends with `— Wyjazdo`. Example title patterns:
  - `Co to jest Wyjazdo i jak działa`
  - `Ile kosztuje Wyjazdo? Cennik i prowizje — Wyjazdo`
  - `Płatności online — BLIK, Przelewy24, karta — Wyjazdo`
- `description` — ~150 chars, contains the actual phrase a user would google.
- `alternates.canonical: '/pomoc/<slug>'`.
- `openGraph` — reuses the default `/opengraph-image` (no custom OG image per page).
- `keywords` — a few each, Polish, descriptive, not stuffed.

### Structured data (JSON-LD)

- **Hub:** `BreadcrumbList` (Wyjazdo → Pomoc) + `WebPage`.
- **Topic pages:** `BreadcrumbList` (Wyjazdo → Pomoc → topic) + `Article` (`headline`, `inLanguage: "pl-PL"`, `datePublished`, `dateModified`, `author.@type: "Organization"`).
- **FAQ page only:** `FAQPage` with each Q/A as a `Question` → `acceptedAnswer.Text`. Eligible for Google's rich Q&A accordion.

### Sitemap

In `src/app/sitemap.ts`, add 9 static entries (hub + 8 topics) between the existing static pages and the dynamic event entries:

- Hub: `priority: 0.7`, `changeFrequency: 'monthly'`.
- Topics: `priority: 0.6`, `changeFrequency: 'monthly'`.

No `robots.ts` change — defaults already allow indexing.

### Internal linking

- **Landing nav (`src/app/page.tsx`):** add `Pomoc` link to the top nav. Placement: left of `Zaloguj się` (signed-out) and left of `Panel organizatora` (signed-in). Same `text-muted-foreground hover:text-foreground` styling as `Zaloguj się`. Mobile: stays visible (small, between logo and auth actions).
- **Dashboard sidebar (`src/components/dashboard/Sidebar.tsx`):** add a secondary "Pomoc" link **below the collapse toggle** (not in primary `NAV_ITEMS`). Styling like the existing public-URL link (`bg-white/8`, `text-[13px]`). Icon: small question-mark-in-circle SVG. Collapsed: icon only with tooltip. Active when `pathname.startsWith('/pomoc')`.
- **Cross-links between docs:** the `RelatedTopics` footer on every topic page surfaces 2–3 siblings → builds the internal link graph Google needs.
- **Deep links to dashboard:** every page links into the relevant dashboard route (`/dashboard/events/new`, `/dashboard/onboarding/payouts`, etc.) so docs feel actionable for signed-in readers.

### Out of scope (deliberately)

- Footer link on the landing page — not in this iteration.
- Mobile bottom tab bar entry — would crowd the four-item primary nav.
- Empty-state / onboarding-banner "Zobacz przewodnik →" nudges — may ship in a follow-up; not blocking this PR.

## Files added & modified

### New

```
src/app/pomoc/
  layout.tsx
  page.tsx
  co-to-jest/page.tsx
  jak-zaczac/page.tsx
  tworzenie-wydarzenia/page.tsx
  platnosci/page.tsx
  uczestnicy/page.tsx
  promocja/page.tsx
  cennik/page.tsx
  faq/page.tsx

src/components/docs/
  DocsArticle.tsx
  DocsCard.tsx
  Callout.tsx
  RelatedTopics.tsx

src/lib/docs/
  topics.ts
```

(`DocsNav.tsx` is optional; nav may live inline in `layout.tsx` if it stays short.)

### Modified

```
src/app/page.tsx                       — "Pomoc" link added to landing nav
src/components/dashboard/Sidebar.tsx   — secondary "Pomoc" link below collapse toggle
src/app/sitemap.ts                     — 9 static entries added
```

## Reused, not duplicated

`WyjazdoMark`, Clerk `<Show>`, `prose` typography, SVG icon style from landing benefits cards, `IBM_Plex_Serif` for H1s, design tokens (`accent`, `primary`, `muted-foreground`).

## Acceptance criteria

- All 9 routes render under `/pomoc` and are reachable from the hub.
- Each page has a unique `<title>` and `description`, a canonical URL, and a single `<h1>`.
- Topic pages render `BreadcrumbList` + `Article` JSON-LD; FAQ also renders `FAQPage` JSON-LD.
- Sitemap (`/sitemap.xml`) includes all 9 URLs.
- "Pomoc" link appears in the landing top nav (both signed-out and signed-in states).
- "Pomoc" link appears in the dashboard sidebar below the collapse toggle, highlights when the current path starts with `/pomoc`.
- All copy is in Polish, in feminine singular direct address, using dashboard terminology.
- All inline links in docs are ≥ `text-sm` and visually distinguishable.
- Hub layout works on mobile (cards stack) and desktop (3-up grid).
- No new database tables, migrations, or env vars.

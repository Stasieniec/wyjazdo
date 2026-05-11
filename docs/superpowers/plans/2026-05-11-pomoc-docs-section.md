# `/pomoc` Docs & Help Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Polish-language docs/help hub at `/pomoc` with 8 topic pages, SEO metadata + JSON-LD, and navigation links from both the landing page and the dashboard.

**Architecture:** New top-level Next.js route segment `src/app/pomoc/` with a shared layout (slim auth-aware nav), a hub `page.tsx` (card grid), and one `<slug>/page.tsx` per topic. Pages are hard-coded TSX — no DB, no MDX. A single `src/lib/docs/topics.ts` module is the source of truth for slugs, titles, and cross-links so the hub, related-topics footer, sitemap, and metadata stay in sync. Visual primitives live in `src/components/docs/`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Clerk (`<Show>` for auth-aware nav), vitest for unit tests. `IBM_Plex_Serif` for H1s (already loaded in landing). All copy is in **Polish**. The existing `prose` Tailwind plugin (already configured for legal pages) is used for body typography.

---

## CRITICAL: Language

**Every user-visible string in this feature MUST be in Polish.** This includes:

- All UI strings: titles, headings, button labels, links, callouts.
- All `<title>` and `<meta description>` content.
- All `<Article>`, `<BreadcrumbList>`, and `<FAQPage>` JSON-LD fields that contain visible text (`headline`, `name`, `description`, `text`, `acceptedAnswer.text`).
- All `aria-label`, `alt`, and `title` attributes the user can perceive.
- All `Co dalej?` / related-topics copy.

The audience is a Polish-speaking woman aged 40–50 who is non-technical. Tone:

- **Feminine singular direct address:** *"zobaczysz", "kliknij", "wprowadź"* (never *"zobaczycie"*, never *"użytkownik"*).
- **No English jargon.** `subdomena` is defined on first use per page. `Stripe` is named (it appears on her invoice) but described as *"nasz operator płatności"*.
- **Money in PLN, never grosze.** Use *"39 zł"*, never *"3900 gr"*.
- **Dashboard terminology, exact:** `Przegląd`, `Wydarzenia`, `Finanse`, `Ustawienia`, `Uczestniczki`, `Wypłaty`, and the wizard step labels `Tytuł`, `Opis`, `Termin`, `Miejsce`, `Uczestnicy`, `Liczba miejsc`, `Płatność`, `Zdjęcia`, `Pytania`, `Zgody` (see [src/lib/wizard/event-creation-steps.ts](src/lib/wizard/event-creation-steps.ts)).
- **No emojis in body content.** Inline SVG icons only, sparingly.

If you find yourself writing an English word that isn't a proper noun (a brand name, a country, a payment method) — stop and translate.

## Before you start: Next.js version

This repo uses Next.js 16, which differs from Next.js you may know. **Before writing any new App Router code (metadata, layouts, dynamic rendering), read the relevant guide in [node_modules/next/dist/docs/01-app/](node_modules/next/dist/docs/01-app/) and heed any deprecation notices.** This is required per [AGENTS.md](AGENTS.md).

---

## File map

### New files

```
src/lib/docs/
  topics.ts                          — slug, title, blurb, icon-id, related[] for all 8 topics; helpers

src/lib/docs/
  topics.test.ts                     — vitest unit tests for the helpers

src/components/docs/
  DocsArticle.tsx                    — narrow reading column + H1 + last-updated + prose slot
  DocsCard.tsx                       — card with icon, title, blurb (used on hub + RelatedTopics)
  Callout.tsx                        — "Uwaga" / "Wskazówka" boxes
  RelatedTopics.tsx                  — renders 2–3 DocsCards for the current topic's `related`
  Icon.tsx                           — string-keyed SVG icon map (so topics.ts can reference icons by id)

src/app/pomoc/
  layout.tsx                         — slim nav + footer wrapper
  page.tsx                           — hub index page
  co-to-jest/page.tsx                — "Co to jest Wyjazdo i jak działa"
  jak-zaczac/page.tsx                — sign-up, onboarding, subdomena
  tworzenie-wydarzenia/page.tsx      — the 10-step wizard walkthrough
  platnosci/page.tsx                 — Stripe setup, methods, wypłaty
  uczestnicy/page.tsx                — list, statuses, anulowanie, eksport
  promocja/page.tsx                  — sharing, OG previews
  cennik/page.tsx                    — pricing
  faq/page.tsx                       — FAQ with FAQPage JSON-LD
```

### Modified files

```
src/app/page.tsx                          — add "Pomoc" link in landing nav
src/components/dashboard/Sidebar.tsx      — add secondary "Pomoc" link below collapse toggle
src/app/sitemap.ts                        — add 9 static entries (hub + 8 topics)
```

---

## Task 1: Topic registry + helpers (with tests)

**Files:**
- Create: `src/lib/docs/topics.ts`
- Create: `src/lib/docs/topics.test.ts`

This is the only piece of pure logic in the feature, and it underpins cross-links + sitemap + metadata. TDD it.

- [ ] **Step 1: Write the failing test**

Create [src/lib/docs/topics.test.ts](src/lib/docs/topics.test.ts):

```ts
import { describe, it, expect } from "vitest";
import {
  TOPICS,
  topicSlugs,
  getTopic,
  getRelatedTopics,
} from "./topics";

describe("topics registry", () => {
  it("has exactly 8 topic pages", () => {
    expect(TOPICS).toHaveLength(8);
  });

  it("every slug is unique", () => {
    const slugs = TOPICS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every related[] slug exists in the registry", () => {
    const slugs = new Set(TOPICS.map((t) => t.slug));
    for (const topic of TOPICS) {
      for (const related of topic.related) {
        expect(slugs.has(related), `${topic.slug} references missing ${related}`).toBe(true);
      }
    }
  });

  it("topicSlugs returns all slugs in order", () => {
    expect(topicSlugs()).toEqual(TOPICS.map((t) => t.slug));
  });

  it("getTopic returns the matching topic", () => {
    expect(getTopic("cennik")?.slug).toBe("cennik");
  });

  it("getTopic returns undefined for unknown slug", () => {
    expect(getTopic("nieistnieje")).toBeUndefined();
  });

  it("getRelatedTopics returns the topic objects for the related slugs", () => {
    const cennik = getTopic("cennik")!;
    const related = getRelatedTopics(cennik.slug);
    expect(related.map((t) => t.slug)).toEqual(cennik.related);
  });

  it("getRelatedTopics returns [] for unknown slug", () => {
    expect(getRelatedTopics("nieistnieje")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/docs/topics.test.ts`
Expected: FAIL — module `./topics` doesn't exist yet.

- [ ] **Step 3: Implement [src/lib/docs/topics.ts](src/lib/docs/topics.ts)**

```ts
export type TopicSlug =
  | "co-to-jest"
  | "jak-zaczac"
  | "tworzenie-wydarzenia"
  | "platnosci"
  | "uczestnicy"
  | "promocja"
  | "cennik"
  | "faq";

export type IconId =
  | "info"
  | "rocket"
  | "calendar"
  | "wallet"
  | "users"
  | "share"
  | "tag"
  | "question";

export interface Topic {
  slug: TopicSlug;
  title: string;
  blurb: string;
  icon: IconId;
  related: TopicSlug[];
}

export const TOPICS: readonly Topic[] = [
  {
    slug: "co-to-jest",
    title: "Co to jest Wyjazdo i jak działa",
    blurb:
      "Krótko, prostym językiem: czym jest Wyjazdo, dla kogo i jak wygląda jeden wyjazd od strony organizatorki.",
    icon: "info",
    related: ["jak-zaczac", "tworzenie-wydarzenia", "cennik"],
  },
  {
    slug: "jak-zaczac",
    title: "Jak zacząć — konto i Twoja strona",
    blurb:
      "Załóż konto, wybierz adres swojej strony i przygotuj wszystko do pierwszego wydarzenia.",
    icon: "rocket",
    related: ["tworzenie-wydarzenia", "platnosci", "co-to-jest"],
  },
  {
    slug: "tworzenie-wydarzenia",
    title: "Tworzenie wydarzenia krok po kroku",
    blurb:
      "Dziesięć ekranów, jeden wyjazd. Co podać w każdym kroku i co możesz później zmienić.",
    icon: "calendar",
    related: ["uczestnicy", "platnosci", "promocja"],
  },
  {
    slug: "platnosci",
    title: "Płatności online i wypłaty",
    blurb:
      "BLIK, Przelewy24, karta. Jak działają zaliczki, kiedy pieniądze trafiają na Twoje konto i co robić, gdy operator prosi o dokumenty.",
    icon: "wallet",
    related: ["uczestnicy", "cennik", "tworzenie-wydarzenia"],
  },
  {
    slug: "uczestnicy",
    title: "Uczestniczki — lista, statusy, zapisy",
    blurb:
      "Jak czytać listę uczestniczek, co oznaczają statusy płatności, jak anulować zapis i wyeksportować dane.",
    icon: "users",
    related: ["platnosci", "tworzenie-wydarzenia", "faq"],
  },
  {
    slug: "promocja",
    title: "Promocja i udostępnianie wydarzenia",
    blurb:
      "Skąd wziąć link, jak działa Twoja subdomena i co zobaczą znajomi, gdy wkleisz adres na Facebooka lub Instagrama.",
    icon: "share",
    related: ["jak-zaczac", "tworzenie-wydarzenia", "uczestnicy"],
  },
  {
    slug: "cennik",
    title: "Ile kosztuje Wyjazdo — cennik i prowizje",
    blurb:
      "Wyjazdo dziś nie pobiera opłat za korzystanie. Wyjaśniamy, co dolicza operator płatności i kiedy może się to zmienić.",
    icon: "tag",
    related: ["platnosci", "co-to-jest", "faq"],
  },
  {
    slug: "faq",
    title: "Najczęstsze pytania (FAQ)",
    blurb:
      "Krótkie odpowiedzi na pytania, które dostajemy najczęściej — od bezpieczeństwa po anulowanie wyjazdu.",
    icon: "question",
    related: ["platnosci", "uczestnicy", "cennik"],
  },
] as const;

export function topicSlugs(): TopicSlug[] {
  return TOPICS.map((t) => t.slug);
}

export function getTopic(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

export function getRelatedTopics(slug: string): Topic[] {
  const topic = getTopic(slug);
  if (!topic) return [];
  return topic.related
    .map((s) => getTopic(s))
    .filter((t): t is Topic => t !== undefined);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/docs/topics.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/docs/topics.ts src/lib/docs/topics.test.ts
git commit -m "feat(pomoc): add topic registry for /pomoc help section"
```

---

## Task 2: Icon component

**Files:**
- Create: `src/components/docs/Icon.tsx`

We need string-keyed SVG icons so the topic registry can reference them by id. Style copies the landing benefits cards.

- [ ] **Step 1: Create [src/components/docs/Icon.tsx](src/components/docs/Icon.tsx)**

```tsx
import type { IconId } from "@/lib/docs/topics";

const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PATHS: Record<IconId, React.ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v5h1" />
    </>
  ),
  rocket: (
    <>
      <path d="M5 14l5 5c1-3 5-7 8-8 1-3 1-7-1-9-2-2-6-2-9-1-1 3-5 7-8 8l5 5" />
      <circle cx="14" cy="10" r="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v6" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M16 13h2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.866 3.134-7 7-7s7 3.134 7 7" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M22 18c0-2.761-2.239-5-5-5" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.5 10.5L15.5 6.5M8.5 13.5L15.5 17.5" />
    </>
  ),
  tag: (
    <>
      <path d="M20 12l-8 8-8-8V4h8z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4M12 17h.01" />
    </>
  ),
};

export function Icon({ id, className }: { id: IconId; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className={className}
      aria-hidden
      {...STROKE_PROPS}
    >
      {PATHS[id]}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/docs/Icon.tsx
git commit -m "feat(pomoc): add Icon component for docs topics"
```

---

## Task 3: DocsCard component

**Files:**
- Create: `src/components/docs/DocsCard.tsx`

Used on the hub grid and inside `RelatedTopics`. Whole card is the link. Title font: `IBM_Plex_Serif` to match the landing benefits cards.

- [ ] **Step 1: Create [src/components/docs/DocsCard.tsx](src/components/docs/DocsCard.tsx)**

```tsx
import Link from "next/link";
import { Icon } from "./Icon";
import type { Topic } from "@/lib/docs/topics";

type Props = {
  topic: Topic;
  /** When true, render a wider card (e.g. col-span-2 on hub). */
  wide?: boolean;
};

export function DocsCard({ topic, wide }: Props) {
  return (
    <Link
      href={`/pomoc/${topic.slug}`}
      className={`group relative flex flex-col rounded-2xl border border-primary/5 bg-white p-6 shadow-[0_15px_40px_-30px_rgba(30,58,95,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-25px_rgba(30,58,95,0.5)] ${
        wide ? "sm:col-span-2 lg:col-span-3" : ""
      }`}
    >
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/12 text-accent">
        <Icon id={topic.icon} />
      </span>
      <h3 className="font-[family-name:var(--font-ibm-plex-serif)] text-lg font-semibold text-primary">
        {topic.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {topic.blurb}
      </p>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/docs/DocsCard.tsx
git commit -m "feat(pomoc): add DocsCard component"
```

---

## Task 4: Callout component

**Files:**
- Create: `src/components/docs/Callout.tsx`

Inline note boxes inside article body. Two variants: `info` (default — warm accent border, "Wskazówka") and `warning` (amber, "Uwaga"). The label is rendered explicitly so a screen reader announces the meaning.

- [ ] **Step 1: Create [src/components/docs/Callout.tsx](src/components/docs/Callout.tsx)**

```tsx
type Variant = "info" | "warning";

const STYLES: Record<Variant, { box: string; label: string; defaultLabel: string }> = {
  info: {
    box: "border-accent/40 bg-accent/8",
    label: "text-accent",
    defaultLabel: "Wskazówka",
  },
  warning: {
    box: "border-amber-300 bg-amber-50",
    label: "text-amber-700",
    defaultLabel: "Uwaga",
  },
};

export function Callout({
  variant = "info",
  label,
  children,
}: {
  variant?: Variant;
  label?: string;
  children: React.ReactNode;
}) {
  const style = STYLES[variant];
  return (
    <aside
      className={`my-6 rounded-xl border-l-4 px-5 py-4 text-sm leading-relaxed text-foreground ${style.box}`}
    >
      <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${style.label}`}>
        {label ?? style.defaultLabel}
      </p>
      {children}
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/docs/Callout.tsx
git commit -m "feat(pomoc): add Callout component for inline notes"
```

---

## Task 5: DocsArticle wrapper

**Files:**
- Create: `src/components/docs/DocsArticle.tsx`

Wraps every topic page: narrow reading column, breadcrumb back to `/pomoc`, H1, last-updated stamp, and `prose` body. Also renders a small JSON-LD `BreadcrumbList` + `Article` block (FAQ page will render its own `FAQPage` block separately and pass `extraJsonLd` here).

- [ ] **Step 1: Create [src/components/docs/DocsArticle.tsx](src/components/docs/DocsArticle.tsx)**

```tsx
import Link from "next/link";
import { siteOrigin } from "@/lib/urls";

type Props = {
  slug: string;
  title: string;
  description: string;
  lastUpdated: string; // ISO date string, e.g. "2026-05-11"
  extraJsonLd?: object;
  children: React.ReactNode;
};

function formatPolishDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DocsArticle({
  slug,
  title,
  description,
  lastUpdated,
  extraJsonLd,
  children,
}: Props) {
  const base = siteOrigin();
  const url = `${base}/pomoc/${slug}`;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Wyjazdo", item: base },
      { "@type": "ListItem", position: 2, name: "Pomoc", item: `${base}/pomoc` },
      { "@type": "ListItem", position: 3, name: title, item: url },
    ],
  };

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: "pl-PL",
    datePublished: lastUpdated,
    dateModified: lastUpdated,
    author: { "@type": "Organization", name: "Wyjazdo", url: base },
    publisher: {
      "@type": "Organization",
      name: "Wyjazdo",
      url: base,
      logo: { "@type": "ImageObject", url: `${base}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
      />
      {extraJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(extraJsonLd) }}
        />
      )}

      <nav aria-label="Okruszki" className="mb-6 text-sm text-muted-foreground">
        <Link href="/pomoc" className="underline hover:text-foreground">
          Pomoc
        </Link>
      </nav>

      <h1 className="font-[family-name:var(--font-ibm-plex-serif)] text-3xl font-semibold leading-tight tracking-tight text-primary sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Ostatnia aktualizacja: {formatPolishDate(lastUpdated)}
      </p>

      <div className="prose prose-neutral mt-8 max-w-none">
        {children}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/docs/DocsArticle.tsx
git commit -m "feat(pomoc): add DocsArticle wrapper with breadcrumb + Article JSON-LD"
```

---

## Task 6: RelatedTopics component

**Files:**
- Create: `src/components/docs/RelatedTopics.tsx`

Footer block for every topic page. Reads the related slugs from the registry.

- [ ] **Step 1: Create [src/components/docs/RelatedTopics.tsx](src/components/docs/RelatedTopics.tsx)**

```tsx
import { getRelatedTopics } from "@/lib/docs/topics";
import { DocsCard } from "./DocsCard";

export function RelatedTopics({ slug }: { slug: string }) {
  const related = getRelatedTopics(slug);
  if (related.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-6 pb-16">
      <h2 className="font-[family-name:var(--font-ibm-plex-serif)] text-xl font-semibold text-primary">
        Co dalej?
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((topic) => (
          <DocsCard key={topic.slug} topic={topic} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/docs/RelatedTopics.tsx
git commit -m "feat(pomoc): add RelatedTopics footer component"
```

---

## Task 7: `/pomoc` layout

**Files:**
- Create: `src/app/pomoc/layout.tsx`

Slim nav at top, content slot, minimal footer. Auth-aware: signed-out users see *Zaloguj się* + *Wypróbuj za darmo*; signed-in users see *Panel organizatora*. Mirrors the landing nav so the visual identity is consistent.

- [ ] **Step 1: Create [src/app/pomoc/layout.tsx](src/app/pomoc/layout.tsx)**

```tsx
import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { IBM_Plex_Serif } from "next/font/google";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";
import { UserMenu } from "@/components/dashboard/UserMenu";

const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ibm-plex-serif",
  display: "swap",
});

export default function PomocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen bg-background ${ibmPlexSerif.variable}`}>
      <nav className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-primary"
          >
            <WyjazdoMark className="h-8 w-8 shrink-0" />
            wyjazdo
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/pomoc"
              className="font-medium text-foreground"
              aria-current="true"
            >
              Pomoc
            </Link>
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Zaloguj się
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
              >
                Wypróbuj za darmo
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
              >
                Panel organizatora
              </Link>
              <UserMenu />
            </Show>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="border-t border-border bg-white px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <Link
            href="/"
            className="font-medium transition-colors hover:text-foreground"
          >
            ← Wróć do strony głównej
          </Link>
          <a
            href="mailto:kontakt@wyjazdo.pl"
            className="transition-colors hover:text-foreground"
          >
            Masz pytanie? kontakt@wyjazdo.pl
          </a>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify the layout renders**

Run: `pnpm dev`
Open: `http://localhost:3000/pomoc` (this will 404 until Task 8 — but the layout chrome should still try to compile cleanly; check the terminal for compile errors).
Expected: Next compiles the layout without TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/layout.tsx
git commit -m "feat(pomoc): add /pomoc layout with auth-aware nav"
```

---

## Task 8: `/pomoc` hub page

**Files:**
- Create: `src/app/pomoc/page.tsx`

Hub: hero, intro paragraph, then the card grid. First card (`co-to-jest`) is wide; rest are 3-up on desktop, 2-up on tablet, 1-up on mobile; `faq` is wide at the bottom. Includes `WebPage` JSON-LD.

- [ ] **Step 1: Create [src/app/pomoc/page.tsx](src/app/pomoc/page.tsx)**

```tsx
import type { Metadata } from "next";
import { DocsCard } from "@/components/docs/DocsCard";
import { TOPICS, getTopic } from "@/lib/docs/topics";
import { siteOrigin } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Pomoc i przewodniki — Wyjazdo",
  description:
    "Jak organizować wyjazdy, retreaty i warsztaty w Wyjazdo — zapisy, płatności online, lista uczestniczek. Prosty język, krok po kroku.",
  alternates: { canonical: "/pomoc" },
  openGraph: {
    title: "Pomoc i przewodniki — Wyjazdo",
    description:
      "Przewodniki dla organizatorek: jak zacząć, jak stworzyć wydarzenie, jak przyjmować płatności online.",
    url: "/pomoc",
    type: "website",
  },
};

export default function PomocHubPage() {
  const base = siteOrigin();
  const intro = getTopic("co-to-jest")!;
  const faq = getTopic("faq")!;
  const middle = TOPICS.filter((t) => t.slug !== "co-to-jest" && t.slug !== "faq");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Pomoc i przewodniki — Wyjazdo",
    url: `${base}/pomoc`,
    inLanguage: "pl-PL",
    description:
      "Centrum pomocy dla organizatorek wyjazdów, retreatów i warsztatów w Wyjazdo.",
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Wyjazdo", item: base },
      { "@type": "ListItem", position: 2, name: "Pomoc", item: `${base}/pomoc` },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <header className="mx-auto max-w-2xl text-center">
        <h1 className="font-[family-name:var(--font-ibm-plex-serif)] text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
          Jak korzystać z Wyjazdo
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Wszystko, czego potrzebujesz, żeby zorganizować swój pierwszy wyjazd.
          Krótkie przewodniki napisane prostym językiem — bez technicznego żargonu.
        </p>
      </header>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <DocsCard topic={intro} wide />
        {middle.map((topic) => (
          <DocsCard key={topic.slug} topic={topic} />
        ))}
        <DocsCard topic={faq} wide />
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Nie znalazłaś odpowiedzi? Napisz:{" "}
        <a
          href="mailto:kontakt@wyjazdo.pl"
          className="font-medium text-foreground underline"
        >
          kontakt@wyjazdo.pl
        </a>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `pnpm dev`
Open: `http://localhost:3000/pomoc`
Expected: page renders. Cards click through to `/pomoc/<slug>` (those routes will 404 until Tasks 9–16 — that's expected at this point). Check the page source for the two `<script type="application/ld+json">` blocks.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/page.tsx
git commit -m "feat(pomoc): add /pomoc hub page with topic grid + JSON-LD"
```

---

## Task 9: Topic page — `/pomoc/co-to-jest`

**Files:**
- Create: `src/app/pomoc/co-to-jest/page.tsx`

The cornerstone explainer. Targets the SEO phrase "co to jest wyjazdo" / "jak działa wyjazdo".

- [ ] **Step 1: Create [src/app/pomoc/co-to-jest/page.tsx](src/app/pomoc/co-to-jest/page.tsx)**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";

const SLUG = "co-to-jest";
const TITLE = "Co to jest Wyjazdo i jak działa";
const DESCRIPTION =
  "Wyjazdo to narzędzie dla organizatorek wyjazdów, retreatów i warsztatów — w jednym miejscu zbierasz zapisy, przyjmujesz płatności online i prowadzisz listę uczestniczek.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "co to jest wyjazdo",
    "jak działa wyjazdo",
    "platforma dla organizatorów wyjazdów",
    "narzędzie do organizacji retreatów",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
      >
        <p>
          <strong>Wyjazdo</strong> to polskie narzędzie dla osób, które
          organizują wyjazdy, retreaty, warsztaty albo kameralne wydarzenia
          dla kobiet. W jednym miejscu zbierasz zapisy, przyjmujesz
          płatności online i prowadzisz listę uczestniczek — bez arkuszy,
          maili z pytaniami i pilnowania przelewów.
        </p>

        <h2>Dla kogo jest Wyjazdo</h2>
        <p>
          Dla organizatorek, które dziś prowadzą zapisy ręcznie: w Google Forms,
          w wiadomościach na Messengerze, w notesie albo w arkuszu kalkulacyjnym.
          Wyjazdo zastępuje to wszystko jedną stroną wydarzenia, którą wysyłasz
          uczestniczkom — same wpisują dane i opłacają zapis online.
        </p>

        <h2>Jak to wygląda w praktyce</h2>
        <ol>
          <li>
            <strong>Zakładasz konto</strong> i wybierasz adres swojej strony —
            na przykład <em>kasia.wyjazdo.pl</em>.
          </li>
          <li>
            <strong>Tworzysz wydarzenie</strong> — wpisujesz tytuł, termin,
            miejsce, cenę i liczbę miejsc. Dodajesz zdjęcia i krótki opis.
          </li>
          <li>
            <strong>Udostępniasz link</strong> uczestniczkom — przez Facebooka,
            Instagrama, maila albo SMS.
          </li>
          <li>
            <strong>Uczestniczki zapisują się same</strong> — wypełniają
            formularz i płacą online (BLIK, Przelewy24 lub karta).
          </li>
          <li>
            <strong>Ty widzisz wszystko w jednym widoku</strong> — kto się
            zapisał, kto zapłacił, kto czeka.
          </li>
          <li>
            <strong>Pieniądze trafiają na Twoje konto</strong> — automatycznie,
            po pomniejszeniu o prowizję operatora płatności.
          </li>
        </ol>

        <h2>Co dostajesz „w pakiecie"</h2>
        <ul>
          <li>Własną stronę z adresem <em>twojaSubdomena.wyjazdo.pl</em>.</li>
          <li>Formularz zapisów z polami, które sama wybierasz.</li>
          <li>Płatności online: BLIK, Przelewy24, karta.</li>
          <li>Listę uczestniczek z informacją o statusie płatności.</li>
          <li>Automatyczne maile potwierdzające zapis i płatność.</li>
          <li>Eksport danych do pliku CSV, gdyby kiedyś były potrzebne.</li>
        </ul>

        <h2>Co Wyjazdo Ci oszczędza</h2>
        <p>
          Najbardziej żmudne rzeczy: pisanie maili z potwierdzeniami, pilnowanie,
          kto zapłacił, ręczne przepisywanie danych do tabeli, sprawdzanie
          rachunku bankowego co kilka godzin przed wyjazdem. To wszystko dzieje
          się samo.
        </p>

        <p>
          Jeśli chcesz spróbować —{" "}
          <Link href="/pomoc/jak-zaczac">przejdź do przewodnika „Jak zacząć"</Link>.
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm dev`
Open: `http://localhost:3000/pomoc/co-to-jest`
Expected: page renders with breadcrumb, H1, prose body, related-topics footer.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/co-to-jest/page.tsx
git commit -m "feat(pomoc): add /pomoc/co-to-jest page"
```

---

## Task 10: Topic page — `/pomoc/jak-zaczac`

**Files:**
- Create: `src/app/pomoc/jak-zaczac/page.tsx`

- [ ] **Step 1: Create [src/app/pomoc/jak-zaczac/page.tsx](src/app/pomoc/jak-zaczac/page.tsx)**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "jak-zaczac";
const TITLE = "Jak zacząć — konto i Twoja strona";
const DESCRIPTION =
  "Załóż konto w Wyjazdo, wybierz adres swojej strony i przygotuj wszystko do pierwszego wydarzenia — w pięć minut.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "jak założyć konto wyjazdo",
    "subdomena wyjazdo",
    "pierwsze logowanie wyjazdo",
    "rejestracja organizatora",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
      >
        <p>
          Założenie konta zajmuje kilka minut. W tym przewodniku
          przeprowadzę Cię przez każdy krok — od kliknięcia
          <em> „Wypróbuj za darmo"</em> do pierwszego logowania w panelu.
        </p>

        <h2>Krok 1. Załóż konto</h2>
        <p>
          Wejdź na <a href="https://wyjazdo.pl">wyjazdo.pl</a> i kliknij
          <em> „Wypróbuj za darmo"</em>. Podaj swój e-mail i ustaw hasło.
          Na podany adres przyjdzie wiadomość — kliknij w nią, żeby
          potwierdzić konto.
        </p>

        <Callout>
          Użyj adresu, do którego masz codzienny dostęp. Na ten sam adres
          przyjdą później powiadomienia o nowych zapisach i o wpływie pieniędzy.
        </Callout>

        <h2>Krok 2. Wybierz adres swojej strony</h2>
        <p>
          Po pierwszym logowaniu Wyjazdo poprosi Cię o wybranie <strong>subdomeny</strong>{" "}
          — czyli krótkiego adresu Twojej strony. Na przykład:{" "}
          <em>kasia.wyjazdo.pl</em>, <em>retreat-mazury.wyjazdo.pl</em> albo{" "}
          <em>warsztaty-anna.wyjazdo.pl</em>.
        </p>
        <p>
          Wybierz coś krótkiego i łatwego do zapamiętania. Na tym adresie
          uczestniczki znajdą wszystkie Twoje wydarzenia. Subdomena nie da
          się później prosto zmienić — pomyśl chwilę, zanim klikniesz <em>„Zapisz"</em>.
        </p>

        <h2>Krok 3. Powiedz nam, kim jesteś</h2>
        <p>
          Wyjazdo zapyta Cię o imię i nazwisko organizatorki oraz o krótki
          opis (kilka zdań o Tobie i o tym, co organizujesz). To pojawi się
          na Twojej stronie — uczestniczki zobaczą, kto je zaprasza.
        </p>

        <h2>Krok 4. Skonfiguruj płatności</h2>
        <p>
          Żeby przyjmować płatności online, musisz raz przejść przez
          konfigurację <strong>Stripe</strong> — to nasz operator płatności.
          Stripe poprosi Cię o dane firmowe (NIP, numer konta) i potwierdzenie
          tożsamości. Wszystko dzieje się na bezpiecznych stronach Stripe.
        </p>
        <p>
          Możesz pominąć ten krok i wrócić do niego później — ale dopóki nie
          dokończysz konfiguracji, nie opublikujesz wydarzenia płatnego.
        </p>
        <p>
          Więcej szczegółów:{" "}
          <Link href="/pomoc/platnosci">Płatności online i wypłaty</Link>.
        </p>

        <h2>Krok 5. Stwórz pierwsze wydarzenie</h2>
        <p>
          Gdy konto jest gotowe, w panelu zobaczysz przycisk{" "}
          <em>„+ Nowe wydarzenie"</em>. Klik — i zaczynasz. Krok po kroku
          opisaliśmy to tutaj:{" "}
          <Link href="/pomoc/tworzenie-wydarzenia">
            Tworzenie wydarzenia krok po kroku
          </Link>
          .
        </p>

        <Callout variant="warning" label="Pamiętaj">
          Konto jest bezpłatne — nie pobieramy żadnych opłat za założenie
          ani za korzystanie z Wyjazdo. Operator płatności (Stripe) pobiera
          swoją prowizję od każdej transakcji.{" "}
          <Link href="/pomoc/cennik">Zobacz cennik</Link>.
        </Callout>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Open: `http://localhost:3000/pomoc/jak-zaczac` — should render.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/jak-zaczac/page.tsx
git commit -m "feat(pomoc): add /pomoc/jak-zaczac page"
```

---

## Task 11: Topic page — `/pomoc/tworzenie-wydarzenia`

**Files:**
- Create: `src/app/pomoc/tworzenie-wydarzenia/page.tsx`

Walks through the wizard. Step labels MUST match those in [src/lib/wizard/event-creation-steps.ts](src/lib/wizard/event-creation-steps.ts): *Tytuł, Opis, Termin, Miejsce, Uczestnicy, Liczba miejsc, Płatność, Zdjęcia, Pytania, Zgody*.

- [ ] **Step 1: Create [src/app/pomoc/tworzenie-wydarzenia/page.tsx](src/app/pomoc/tworzenie-wydarzenia/page.tsx)**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "tworzenie-wydarzenia";
const TITLE = "Tworzenie wydarzenia krok po kroku";
const DESCRIPTION =
  "Dziesięć ekranów, jedno wydarzenie. Co podajesz w każdym kroku tworzenia wyjazdu w Wyjazdo i co możesz zmienić później.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "jak stworzyć wydarzenie wyjazdo",
    "kreator wydarzenia wyjazdo",
    "wyjazdo krok po kroku",
    "organizacja wyjazdu online",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
      >
        <p>
          Tworzenie wydarzenia w Wyjazdo to dziesięć krótkich ekranów.
          Każdy z nich pyta tylko o jedną rzecz. Możesz przerwać w dowolnym
          momencie — postęp zapisuje się automatycznie i wracasz tam, gdzie
          skończyłaś.
        </p>

        <p>
          Żeby zacząć, w panelu kliknij <em>„+ Nowe wydarzenie"</em>.
        </p>

        <h2>1. Tytuł</h2>
        <p>
          Nazwa wydarzenia, którą zobaczą uczestniczki — na przykład{" "}
          <em>„Retreat jogi w Bieszczadach"</em> albo{" "}
          <em>„Weekend ceramiki, listopad 2026"</em>. Krótko, konkretnie.
          Tytuł trafia także do adresu strony Twojego wydarzenia.
        </p>

        <h2>2. Opis</h2>
        <p>
          Tutaj rozwijasz, czego uczestniczka może się spodziewać. Plan dnia,
          poziom zaawansowania, co warto wziąć ze sobą. Możesz pisać krótkie
          akapity albo dodać listę punktów — wszystko pojawi się na publicznej
          stronie wydarzenia.
        </p>

        <Callout>
          Opis można zmienić w każdej chwili — także po publikacji. Nie musisz
          mieć od razu finalnej wersji.
        </Callout>

        <h2>3. Termin</h2>
        <p>
          Data i godzina rozpoczęcia oraz zakończenia. Jeśli wyjazd trwa
          kilka dni, podaj pierwszy i ostatni dzień. Strefa czasowa jest
          ustawiona na polską (Europa/Warszawa).
        </p>

        <h2>4. Miejsce</h2>
        <p>
          Adres lub nazwa miejsca. Może być ogólne („Bieszczady, ośrodek
          Słoneczne Wzgórze") albo dokładne („Lutowiska, ul. Bieszczadzka 12").
          Pojawi się na stronie wydarzenia.
        </p>

        <h2>5. Uczestnicy</h2>
        <p>
          Definiujesz <strong>typy uczestników</strong> — czyli rodzaje
          biletów. Najprościej: jeden typ („Uczestniczka") z jedną ceną.
          Bardziej rozbudowanie: kilka typów z różnymi cenami (na przykład
          „Dorosły" i „Dziecko") albo cena malejąca przy większej liczbie osób.
        </p>
        <p>
          Każdy typ ma minimalną i maksymalną liczbę osób w jednym zapisie —
          dzięki temu możesz mieć na przykład <em>„Pakiet rodzinny — od 2 do 5 osób"</em>.
        </p>

        <h2>6. Liczba miejsc</h2>
        <p>
          Ile osób w sumie się zmieści. Gdy zapisze się tyle uczestniczek,
          formularz zapisu zamyka się automatycznie, a kolejne osoby trafiają
          na listę oczekujących.
        </p>

        <h2>7. Płatność</h2>
        <p>
          Ekran widoczny tylko wtedy, gdy Twoje wydarzenie nie jest bezpłatne.
          Tutaj decydujesz:
        </p>
        <ul>
          <li>
            <strong>Pełna kwota od razu</strong> — uczestniczka płaci całość
            podczas zapisu.
          </li>
          <li>
            <strong>Zaliczka teraz, reszta przed wyjazdem</strong> —
            wskazujesz wysokość zaliczki i datę, do której uczestniczka ma
            dopłacić resztę. Przypomnienie wysyła się samo.
          </li>
        </ul>
        <p>
          Szczegóły dotyczące metod płatności i prowizji opisaliśmy w{" "}
          <Link href="/pomoc/platnosci">Płatności online i wypłaty</Link>.
        </p>

        <h2>8. Zdjęcia</h2>
        <p>
          Zdjęcie główne (tzw. <em>cover</em>) plus opcjonalnie kilka zdjęć
          do galerii. Dobre zdjęcie zwiększa liczbę zapisów — pokaż miejsce,
          atmosferę, ludzi.
        </p>

        <h2>9. Pytania</h2>
        <p>
          Własne pytania, które uczestniczki dostaną w formularzu zapisu — na
          przykład <em>„Czy masz alergie pokarmowe?"</em>, <em>„Z jakiego miasta
          przyjeżdżasz?"</em>, <em>„Preferencje co do pokoju"</em>. Możesz wybrać
          typ pola (krótka odpowiedź, długa odpowiedź, wybór z listy) i czy
          pytanie jest obowiązkowe.
        </p>

        <h2>10. Zgody</h2>
        <p>
          Zgody, które uczestniczka zaznacza podczas zapisu (regulamin,
          przetwarzanie danych). Większość z nich Wyjazdo generuje za Ciebie
          automatycznie — możesz dodać własne, jeśli masz na przykład
          regulamin uczestnictwa.
        </p>

        <h2>Publikacja</h2>
        <p>
          Po przejściu wszystkich kroków zobaczysz podgląd swojej strony.
          Kiedy klikniesz <em>„Opublikuj"</em>, wydarzenie staje się widoczne
          pod Twoją subdomeną i można się zapisywać.
        </p>

        <Callout variant="warning" label="Zanim opublikujesz">
          Sprawdź, czy masz dokończoną konfigurację Stripe (płatności). Bez
          niej wydarzenie płatne się nie opublikuje. Jeśli wyjazd jest
          bezpłatny, możesz publikować od razu.
        </Callout>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Open: `http://localhost:3000/pomoc/tworzenie-wydarzenia`.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/tworzenie-wydarzenia/page.tsx
git commit -m "feat(pomoc): add /pomoc/tworzenie-wydarzenia page"
```

---

## Task 12: Topic page — `/pomoc/platnosci`

**Files:**
- Create: `src/app/pomoc/platnosci/page.tsx`

- [ ] **Step 1: Create [src/app/pomoc/platnosci/page.tsx](src/app/pomoc/platnosci/page.tsx)**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "platnosci";
const TITLE = "Płatności online i wypłaty";
const DESCRIPTION =
  "Jak działają płatności online w Wyjazdo: BLIK, Przelewy24, karta. Kiedy pieniądze trafiają na Twoje konto i co robić, gdy operator prosi o dokumenty.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "płatności online wyjazdo",
    "blik wyjazdo",
    "przelewy24 wyjazdo",
    "wypłaty wyjazdo",
    "stripe organizator",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
      >
        <p>
          Wyjazdo nie obsługuje pieniędzy samodzielnie. Tym zajmuje się{" "}
          <strong>Stripe</strong> — nasz operator płatności (zobaczysz tę
          nazwę na fakturach i na pasku adresu, gdy uczestniczka będzie
          płacić). Stripe trzyma środki bezpiecznie i przelewa je na Twoje
          konto.
        </p>

        <h2>Jakie metody płatności widzą uczestniczki</h2>
        <ul>
          <li>
            <strong>BLIK</strong> — najpopularniejsza metoda w Polsce.
            Uczestniczka wpisuje 6-cyfrowy kod z aplikacji bankowej.
          </li>
          <li>
            <strong>Przelewy24</strong> — przelew bankowy z poziomu strony
            jej banku.
          </li>
          <li>
            <strong>Karta</strong> — Visa, Mastercard, także Apple Pay i
            Google Pay.
          </li>
        </ul>
        <p>
          Nie musisz nic włączać ręcznie — metody płatności pojawiają się
          automatycznie po skonfigurowaniu Stripe.
        </p>

        <h2>Konfiguracja Stripe — co musisz zrobić</h2>
        <p>
          Raz, przed pierwszym płatnym wydarzeniem. Wyjazdo przeprowadzi Cię
          przez to w panelu (kliknij <em>„Skonfiguruj teraz"</em> w żółtej
          ramce na <Link href="/dashboard">Przeglądzie</Link>).
        </p>
        <p>Stripe poprosi Cię o:</p>
        <ul>
          <li>Numer NIP (Twojej działalności gospodarczej lub firmy).</li>
          <li>Numer konta bankowego, na które będą wpływać wypłaty.</li>
          <li>Dane do potwierdzenia tożsamości (np. zdjęcie dowodu).</li>
        </ul>
        <p>
          Konfiguracja trwa zwykle 10–15 minut. Stripe weryfikuje dane —
          najczęściej od kilku minut do 1–2 dni roboczych.
        </p>

        <Callout variant="warning" label="Gdy Stripe prosi o dodatkowe dokumenty">
          Czasem Stripe potrzebuje dodatkowych informacji (np. potwierdzenia
          rejestracji firmy). Dostaniesz wtedy maila ze Stripe oraz
          powiadomienie w panelu. Wystarczy zalogować się i dosłać to,
          o co prosi.
        </Callout>

        <h2>Zaliczka i pełna płatność</h2>
        <p>
          Możesz pobrać od uczestniczki całość ceny od razu albo podzielić
          ją na <strong>zaliczkę</strong> i <strong>resztę przed wyjazdem</strong>.
          Drugą opcję ustawiasz w kroku <em>„Płatność"</em> kreatora wydarzenia
          — podajesz wysokość zaliczki i datę, do której uczestniczka ma
          dopłacić.
        </p>
        <p>
          Przypomnienie o doliczeniu reszty wysyła się automatycznie. Ty
          widzisz w panelu, kto już dopłacił, a kto jeszcze nie.
        </p>

        <h2>Kiedy pieniądze trafiają na Twoje konto</h2>
        <p>
          Po pomyślnej weryfikacji w Stripe wypłaty na Twoje konto bankowe
          dzieją się automatycznie — zwykle co kilka dni roboczych.
          Dokładny harmonogram zobaczysz w sekcji <em>Finanse</em> w panelu.
        </p>

        <h2>Co dolicza Stripe</h2>
        <p>
          Stripe pobiera swoją prowizję od każdej transakcji. Stawka zależy
          od metody płatności i jest publikowana przez Stripe:{" "}
          <a
            href="https://stripe.com/pl/pricing"
            target="_blank"
            rel="noopener noreferrer"
          >
            stripe.com/pl/pricing
          </a>
          . Prowizja jest odejmowana automatycznie — na konto wpływa już
          pomniejszona kwota.
        </p>

        <h2>Zwroty i anulacje</h2>
        <p>
          Możesz zwrócić uczestniczce pełną kwotę albo część (np. potrącić
          zaliczkę zgodnie ze swoim regulaminem). Zwrot uruchamiasz z poziomu
          listy uczestniczek — opisaliśmy to w{" "}
          <Link href="/pomoc/uczestnicy">Uczestniczki — lista, statusy, zapisy</Link>.
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Open: `http://localhost:3000/pomoc/platnosci`.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/platnosci/page.tsx
git commit -m "feat(pomoc): add /pomoc/platnosci page"
```

---

## Task 13: Topic page — `/pomoc/uczestnicy`

**Files:**
- Create: `src/app/pomoc/uczestnicy/page.tsx`

- [ ] **Step 1: Create [src/app/pomoc/uczestnicy/page.tsx](src/app/pomoc/uczestnicy/page.tsx)**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "uczestnicy";
const TITLE = "Uczestniczki — lista, statusy, zapisy";
const DESCRIPTION =
  "Jak czytać listę uczestniczek w Wyjazdo, co oznaczają statusy, jak anulować zapis, wyeksportować dane i odpowiedzieć na własne pytania.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "lista uczestników wyjazdo",
    "statusy płatności",
    "anulowanie zapisu",
    "eksport uczestników",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
      >
        <p>
          Kiedy ktoś zapisze się na Twoje wydarzenie, dostaniesz powiadomienie
          mailem, a osoba pojawi się na liście uczestniczek. W tym przewodniku
          pokazujemy, jak tę listę czytać i co możesz z nią zrobić.
        </p>

        <h2>Gdzie znajdę listę</h2>
        <p>
          W panelu kliknij <em>Wydarzenia</em>, wybierz wydarzenie, a następnie
          przejdź do zakładki <em>Uczestniczki</em>.
        </p>

        <h2>Co oznaczają statusy</h2>
        <ul>
          <li>
            <strong>Opłacone</strong> — uczestniczka zapłaciła pełną kwotę.
            Wszystko gotowe.
          </li>
          <li>
            <strong>Zaliczka opłacona</strong> — wpłacono zaliczkę, czeka na
            dopłatę reszty.
          </li>
          <li>
            <strong>Oczekuje</strong> — zapis założony, ale jeszcze nie
            opłacony. Czasem to znaczy, że uczestniczka zaczęła płacić i nie
            dokończyła — wraca przez link z maila i kończy.
          </li>
          <li>
            <strong>Anulowane</strong> — zapis anulowany (przez uczestniczkę
            albo przez Ciebie).
          </li>
          <li>
            <strong>Lista oczekujących</strong> — gdy wydarzenie jest pełne,
            kolejne osoby trafiają tutaj.
          </li>
        </ul>

        <h2>Jak działa lista oczekujących</h2>
        <p>
          Gdy ktoś z głównej listy anuluje zapis, pierwsza osoba z listy
          oczekujących dostaje maila z propozycją dołączenia i czasem na
          zapłatę. Jeśli nie skorzysta, propozycja idzie do kolejnej osoby.
        </p>

        <h2>Własne pytania — gdzie zobaczyć odpowiedzi</h2>
        <p>
          Jeśli w kroku <em>„Pytania"</em>{" "}
          (<Link href="/pomoc/tworzenie-wydarzenia">w kreatorze wydarzenia</Link>){" "}
          dodałaś własne pytania (np. „Alergie pokarmowe?"), odpowiedzi
          uczestniczek znajdziesz w szczegółach każdego zapisu — kliknij
          rząd na liście, żeby otworzyć kartę osoby.
        </p>

        <h2>Anulowanie i zwrot</h2>
        <p>
          Kliknij wiersz uczestniczki i wybierz <em>„Anuluj zapis"</em>.
          Wyjazdo zapyta, czy chcesz zwrócić pełną kwotę, część czy nic
          (np. potrącić zaliczkę zgodnie z Twoim regulaminem).
        </p>
        <p>
          Po potwierdzeniu zwrotu pieniądze wracają na konto, z którego
          przyszły. To trwa zwykle od kilku godzin do kilku dni roboczych —
          zależnie od banku uczestniczki.
        </p>

        <Callout variant="warning">
          Po anulowaniu i zwrocie zapisu nie da się go już cofnąć. Jeśli
          uczestniczka chce wrócić, musi zapisać się ponownie.
        </Callout>

        <h2>Eksport do pliku CSV</h2>
        <p>
          Nad listą uczestniczek znajdziesz przycisk <em>„Eksportuj"</em>.
          Wyjazdo pobierze plik CSV z imionami, e-mailami, statusami i
          odpowiedziami na Twoje pytania. Plik otwiera się w Excelu, Numbers
          albo Arkuszach Google.
        </p>

        <h2>Komunikacja z uczestniczkami</h2>
        <p>
          Automatyczne maile (potwierdzenie zapisu, potwierdzenie płatności,
          przypomnienie o dopłacie reszty) wysyła Wyjazdo. Jeśli chcesz
          napisać do całej grupy coś własnego — najlepiej skopiuj e-maile
          z eksportu CSV i wyślij wiadomość ze swojej skrzynki.
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Open: `http://localhost:3000/pomoc/uczestnicy`.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/uczestnicy/page.tsx
git commit -m "feat(pomoc): add /pomoc/uczestnicy page"
```

---

## Task 14: Topic page — `/pomoc/promocja`

**Files:**
- Create: `src/app/pomoc/promocja/page.tsx`

- [ ] **Step 1: Create [src/app/pomoc/promocja/page.tsx](src/app/pomoc/promocja/page.tsx)**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "promocja";
const TITLE = "Promocja i udostępnianie wydarzenia";
const DESCRIPTION =
  "Skąd wziąć link do wydarzenia, jak działa subdomena i co zobaczą znajomi, gdy wkleisz adres na Facebooka albo Instagrama.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "udostępnianie wydarzenia",
    "subdomena wyjazdo",
    "link do wydarzenia",
    "podgląd na facebooku",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
      >
        <p>
          Każde Twoje wydarzenie ma własny adres internetowy. Wystarczy go
          skopiować i wysłać — uczestniczki wejdą na stronę, przeczytają
          szczegóły i się zapiszą.
        </p>

        <h2>Twoja subdomena</h2>
        <p>
          <strong>Subdomena</strong> to początek Twojego adresu — wybierasz
          ją przy zakładaniu konta. Na przykład, jeśli wybrałaś{" "}
          <em>kasia</em>, Twój adres to <em>kasia.wyjazdo.pl</em>. Na tej
          stronie pojawiają się wszystkie Twoje opublikowane wydarzenia.
        </p>

        <h2>Adres pojedynczego wydarzenia</h2>
        <p>
          Każde wydarzenie ma własny krótki adres, na przykład:
        </p>
        <p>
          <code>kasia.wyjazdo.pl/retreat-mazury-listopad</code>
        </p>
        <p>
          Adres dostajesz po opublikowaniu wydarzenia. W panelu obok tytułu
          jest przycisk <em>„Skopiuj link"</em>.
        </p>

        <h2>Gdzie warto wkleić link</h2>
        <ul>
          <li>
            <strong>Facebook</strong> — w poście, w wydarzeniu na FB, w
            grupie tematycznej.
          </li>
          <li>
            <strong>Instagram</strong> — w opisie profilu („link w bio"),
            w relacji ze stickerem linku, w historii wyróżnionej.
          </li>
          <li>
            <strong>Newsletter</strong> — w mailingu do swoich klientek.
          </li>
          <li>
            <strong>WhatsApp / Messenger</strong> — w rozmowie z konkretną
            osobą lub w grupie.
          </li>
        </ul>

        <h2>Co zobaczą znajomi, gdy wkleisz link</h2>
        <p>
          Facebook, Messenger, WhatsApp i większość innych aplikacji
          automatycznie pokazują podgląd strony — zdjęcie, tytuł i krótki
          opis. Wyjazdo dba o to, żeby ten podgląd dobrze wyglądał: pojawia
          się Twoje zdjęcie główne wydarzenia, tytuł i pierwsze zdania opisu.
        </p>

        <Callout>
          Jeśli podgląd na Facebooku wygląda dziwnie albo nie pokazuje
          zdjęcia, najczęściej to znaczy, że Facebook zapamiętał starą
          wersję strony. Można to „odświeżyć" w narzędziu Facebook Sharing
          Debugger — w razie wątpliwości napisz do nas:{" "}
          <a href="mailto:kontakt@wyjazdo.pl">kontakt@wyjazdo.pl</a>.
        </Callout>

        <h2>Kilka praktycznych rad</h2>
        <ul>
          <li>
            <strong>Zdjęcie ma znaczenie.</strong> Mocne, jasne, z atmosferą
            miejsca — to ono sprzedaje wyjazd na pierwszy rzut oka.
          </li>
          <li>
            <strong>Pierwsze zdanie opisu.</strong> Często to wszystko, co
            ktoś przeczyta w podglądzie. Powiedz, co to za wyjazd, dla kogo
            i kiedy.
          </li>
          <li>
            <strong>Termin w tytule.</strong> Listopad? Wiosna 2026? Jeśli
            data jest w tytule, łatwiej decyduje się o kliknięciu.
          </li>
        </ul>

        <p>
          Jeśli jeszcze nie masz wydarzenia, zacznij od{" "}
          <Link href="/pomoc/tworzenie-wydarzenia">
            Tworzenie wydarzenia krok po kroku
          </Link>
          .
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Open: `http://localhost:3000/pomoc/promocja`.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/promocja/page.tsx
git commit -m "feat(pomoc): add /pomoc/promocja page"
```

---

## Task 15: Topic page — `/pomoc/cennik`

**Files:**
- Create: `src/app/pomoc/cennik/page.tsx`

**Important pricing accuracy note for the implementer:**

The current state, per [src/lib/legal/seed-documents.ts](src/lib/legal/seed-documents.ts) clause 4.2 of the organizer Regulamin: **Wyjazdo does not currently charge organizers for using the platform.** The legal doc states Wyjazdo reserves the right to introduce fees in the future, with at least 30 days' notice by e-mail. Stripe charges its own per-transaction fees. **Do not invent specific Stripe percentages** in this page — link to `stripe.com/pl/pricing` for the authoritative rates. If the user wants concrete Stripe numbers quoted, they should add them in a follow-up after confirming the current published rates.

- [ ] **Step 1: Create [src/app/pomoc/cennik/page.tsx](src/app/pomoc/cennik/page.tsx)**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "cennik";
const TITLE = "Ile kosztuje Wyjazdo — cennik i prowizje";
const DESCRIPTION =
  "Wyjazdo nie pobiera dziś opłat za korzystanie. Wyjaśniamy, co dolicza operator płatności (Stripe) i kiedy może się to zmienić.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "ile kosztuje wyjazdo",
    "cennik wyjazdo",
    "prowizja wyjazdo",
    "opłaty wyjazdo",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
      >
        <p>
          Wyjazdo jest dziś bezpłatne dla organizatorek. Nie pobieramy opłaty
          za założenie konta ani za korzystanie z platformy. Jedyne koszty,
          jakie mogą się pojawić, dotyczą obsługi płatności online.
        </p>

        <h2>Opłaty po stronie Wyjazdo</h2>
        <ul>
          <li>
            <strong>Założenie konta:</strong> bezpłatne.
          </li>
          <li>
            <strong>Korzystanie z panelu organizatorki:</strong> bezpłatne.
          </li>
          <li>
            <strong>Strona z subdomeną</strong> (np. <em>kasia.wyjazdo.pl</em>):
            bezpłatna.
          </li>
          <li>
            <strong>Publikowanie wydarzeń:</strong> bezpłatne, bez limitu liczby.
          </li>
          <li>
            <strong>Automatyczne maile</strong> do uczestniczek (potwierdzenia,
            przypomnienia): bezpłatne.
          </li>
        </ul>

        <h2>Prowizje operatora płatności (Stripe)</h2>
        <p>
          Płatności online obsługuje <strong>Stripe</strong>. Stripe pobiera
          prowizję od każdej transakcji — stawka zależy od metody (BLIK,
          Przelewy24, karta) i jest publikowana przez Stripe. Aktualny cennik
          znajdziesz tutaj:{" "}
          <a
            href="https://stripe.com/pl/pricing"
            target="_blank"
            rel="noopener noreferrer"
          >
            stripe.com/pl/pricing
          </a>
          .
        </p>
        <p>
          Prowizja jest pobierana automatycznie — na Twoje konto bankowe
          wpływa już kwota po jej odjęciu.
        </p>

        <Callout>
          Przykład w uproszczeniu: uczestniczka płaci 500 zł BLIK-iem. Stripe
          potrąca swoją prowizję od tej kwoty. Na Twoje konto trafia różnica
          (np. 493 zł — dokładna kwota zależy od aktualnej stawki Stripe).
        </Callout>

        <h2>Kiedy może się to zmienić</h2>
        <p>
          Zastrzegamy sobie prawo do wprowadzenia opłat za korzystanie z
          Wyjazdo w przyszłości. Jeśli to się stanie, poinformujemy Cię
          mailowo z co najmniej <strong>30-dniowym wyprzedzeniem</strong>{" "}
          — opłaty nigdy nie będą pobierane wstecznie. Tak mówi nasz{" "}
          <Link href="/regulamin">Regulamin</Link>, punkt 4.2.
        </p>

        <h2>Faktury</h2>
        <p>
          Stripe wystawia faktury za swoje prowizje. Znajdziesz je w panelu
          Stripe (logujesz się ze swoich danych, podanych przy konfiguracji).
        </p>

        <p>
          Masz pytanie o konkretną sytuację? Napisz:{" "}
          <a href="mailto:kontakt@wyjazdo.pl">kontakt@wyjazdo.pl</a>.
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Open: `http://localhost:3000/pomoc/cennik`.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/cennik/page.tsx
git commit -m "feat(pomoc): add /pomoc/cennik page"
```

---

## Task 16: Topic page — `/pomoc/faq` (with `FAQPage` JSON-LD)

**Files:**
- Create: `src/app/pomoc/faq/page.tsx`

This page renders both the visible Q&A list and a `FAQPage` JSON-LD block — `DocsArticle` accepts `extraJsonLd` for exactly this. Each Q in the visible list must EXACTLY match its `name` in the JSON-LD (Google requires this).

- [ ] **Step 1: Create [src/app/pomoc/faq/page.tsx](src/app/pomoc/faq/page.tsx)**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";

const SLUG = "faq";
const TITLE = "Najczęstsze pytania (FAQ)";
const DESCRIPTION =
  "Krótkie odpowiedzi na pytania, które dostajemy najczęściej — od bezpieczeństwa płatności po anulowanie wyjazdu i kontakt z uczestniczkami.";
const LAST_UPDATED = "2026-05-11";

type QA = { q: string; a: React.ReactNode; aText: string };

const FAQ: QA[] = [
  {
    q: "Czy Wyjazdo jest bezpieczne dla uczestniczek?",
    a: (
      <p>
        Tak. Płatności obsługuje Stripe — globalny operator certyfikowany
        zgodnie ze standardami bezpieczeństwa PCI DSS. Wyjazdo nigdy nie
        widzi numerów kart ani danych logowania do bankowości. Strony, na
        których uczestniczka podaje dane, działają w pełni szyfrowane (HTTPS).
      </p>
    ),
    aText:
      "Tak. Płatności obsługuje Stripe — globalny operator certyfikowany zgodnie ze standardami bezpieczeństwa PCI DSS. Wyjazdo nigdy nie widzi numerów kart ani danych logowania do bankowości. Strony, na których uczestniczka podaje dane, działają w pełni szyfrowane (HTTPS).",
  },
  {
    q: "Ile kosztuje Wyjazdo?",
    a: (
      <p>
        Korzystanie z Wyjazdo jest dziś bezpłatne dla organizatorek.
        Prowizję od każdej transakcji pobiera tylko operator płatności
        (Stripe) — szczegóły opisaliśmy w{" "}
        <Link href="/pomoc/cennik">Cennik</Link>.
      </p>
    ),
    aText:
      "Korzystanie z Wyjazdo jest dziś bezpłatne dla organizatorek. Prowizję od każdej transakcji pobiera tylko operator płatności (Stripe) — szczegóły opisaliśmy w sekcji Cennik.",
  },
  {
    q: "Czy muszę mieć firmę, żeby korzystać z Wyjazdo?",
    a: (
      <p>
        Tak — żeby przyjmować płatności online, potrzebujesz zarejestrowanej
        działalności gospodarczej albo spółki. Stripe wymaga numeru NIP do
        wypłat. Jeśli chcesz prowadzić wydarzenia bezpłatne, możesz korzystać
        z Wyjazdo bez konfiguracji Stripe.
      </p>
    ),
    aText:
      "Tak — żeby przyjmować płatności online, potrzebujesz zarejestrowanej działalności gospodarczej albo spółki. Stripe wymaga numeru NIP do wypłat. Jeśli chcesz prowadzić wydarzenia bezpłatne, możesz korzystać z Wyjazdo bez konfiguracji Stripe.",
  },
  {
    q: "Co się stanie, jeśli muszę odwołać cały wyjazd?",
    a: (
      <p>
        Możesz anulować wydarzenie z poziomu panelu. Wyjazdo poprowadzi Cię
        przez zwrot pieniędzy uczestniczkom — pełny, częściowy albo żaden,
        zgodnie z tym, co ustaliłaś w swoim regulaminie. Najlepiej napisz do
        uczestniczek prywatnie, zanim klikniesz anuluj.
      </p>
    ),
    aText:
      "Możesz anulować wydarzenie z poziomu panelu. Wyjazdo poprowadzi Cię przez zwrot pieniędzy uczestniczkom — pełny, częściowy albo żaden, zgodnie z tym, co ustaliłaś w swoim regulaminie. Najlepiej napisz do uczestniczek prywatnie, zanim klikniesz anuluj.",
  },
  {
    q: "Czy mogę zmienić cenę albo termin po publikacji?",
    a: (
      <p>
        Większość rzeczy tak — opis, zdjęcia, pytania, zgody. Termin i cena
        są wrażliwe: jeśli ktoś już się zapisał, zmiana wpłynie na te osoby
        i może wymagać kontaktu z nimi. Wyjazdo ostrzeże Cię przed taką
        zmianą.
      </p>
    ),
    aText:
      "Większość rzeczy tak — opis, zdjęcia, pytania, zgody. Termin i cena są wrażliwe: jeśli ktoś już się zapisał, zmiana wpłynie na te osoby i może wymagać kontaktu z nimi. Wyjazdo ostrzeże Cię przed taką zmianą.",
  },
  {
    q: "Jak długo czekam na wypłatę?",
    a: (
      <p>
        Po pomyślnej weryfikacji w Stripe wypłaty następują automatycznie,
        zwykle co kilka dni roboczych. Dokładny harmonogram zobaczysz w
        sekcji <em>Finanse</em> w panelu.
      </p>
    ),
    aText:
      "Po pomyślnej weryfikacji w Stripe wypłaty następują automatycznie, zwykle co kilka dni roboczych. Dokładny harmonogram zobaczysz w sekcji Finanse w panelu.",
  },
  {
    q: "Czy mogę mieć kilka różnych wydarzeń jednocześnie?",
    a: (
      <p>
        Tak. Nie ma limitu liczby wydarzeń. Wszystkie pojawiają się na Twojej
        subdomenie (np. <em>kasia.wyjazdo.pl</em>) — uczestniczki mogą
        wybierać między nimi.
      </p>
    ),
    aText:
      "Tak. Nie ma limitu liczby wydarzeń. Wszystkie pojawiają się na Twojej subdomenie (np. kasia.wyjazdo.pl) — uczestniczki mogą wybierać między nimi.",
  },
  {
    q: "A jeśli utknę i nie wiem, co kliknąć?",
    a: (
      <p>
        Napisz do nas:{" "}
        <a href="mailto:kontakt@wyjazdo.pl">kontakt@wyjazdo.pl</a>.
        Odpowiadamy w ciągu jednego dnia roboczego. Najczęściej w kilka
        godzin.
      </p>
    ),
    aText:
      "Napisz do nas: kontakt@wyjazdo.pl. Odpowiadamy w ciągu jednego dnia roboczego. Najczęściej w kilka godzin.",
  },
];

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "faq wyjazdo",
    "najczęstsze pytania wyjazdo",
    "wyjazdo pytania",
    "wyjazdo bezpieczne",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "pl-PL",
    mainEntity: FAQ.map(({ q, aText }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: aText },
    })),
  };

  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
        extraJsonLd={faqJsonLd}
      >
        <p>
          Wybrałyśmy pytania, które najczęściej dostajemy. Jeśli Twojego nie
          ma — napisz:{" "}
          <a href="mailto:kontakt@wyjazdo.pl">kontakt@wyjazdo.pl</a>.
        </p>

        <dl>
          {FAQ.map(({ q, a }) => (
            <div key={q} className="mb-6">
              <dt className="font-[family-name:var(--font-ibm-plex-serif)] text-lg font-semibold text-primary">
                {q}
              </dt>
              <dd className="mt-2 text-base leading-relaxed text-foreground">
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Open: `http://localhost:3000/pomoc/faq`.
View page source — check that the `<script type="application/ld+json">` block contains a `FAQPage` with all 8 questions.

- [ ] **Step 3: Commit**

```bash
git add src/app/pomoc/faq/page.tsx
git commit -m "feat(pomoc): add /pomoc/faq page with FAQPage JSON-LD"
```

---

## Task 17: Add `Pomoc` link to landing nav

**Files:**
- Modify: [src/app/page.tsx](src/app/page.tsx) (the marketing landing)

Add a `Pomoc` link in the nav, placed left of `Zaloguj się` (signed-out) and left of `Panel organizatora` (signed-in). Use the same `text-muted-foreground` styling as `Zaloguj się`.

- [ ] **Step 1: Open [src/app/page.tsx](src/app/page.tsx) and find the `Show when="signed-out"` block around line 52**

The current code (signed-out branch):

```tsx
<Show when="signed-out">
  <div className="flex items-center gap-3 text-sm">
    <Link
      href="/sign-in"
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      Zaloguj się
    </Link>
    <Link
      href="/sign-up"
      className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
    >
      Wypróbuj za darmo
    </Link>
  </div>
</Show>
```

- [ ] **Step 2: Add the `Pomoc` link before the `Zaloguj się` link**

Replace the block above with:

```tsx
<Show when="signed-out">
  <div className="flex items-center gap-3 text-sm">
    <Link
      href="/pomoc"
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      Pomoc
    </Link>
    <Link
      href="/sign-in"
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      Zaloguj się
    </Link>
    <Link
      href="/sign-up"
      className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
    >
      Wypróbuj za darmo
    </Link>
  </div>
</Show>
```

- [ ] **Step 3: Find the `Show when="signed-in"` block right below it**

The current code:

```tsx
<Show when="signed-in">
  <div className="flex items-center gap-4 text-sm">
    <Link
      href="/dashboard"
      className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
    >
      Panel organizatora
    </Link>
    <UserMenu />
  </div>
</Show>
```

- [ ] **Step 4: Add the `Pomoc` link before the `Panel organizatora` button**

Replace with:

```tsx
<Show when="signed-in">
  <div className="flex items-center gap-4 text-sm">
    <Link
      href="/pomoc"
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      Pomoc
    </Link>
    <Link
      href="/dashboard"
      className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
    >
      Panel organizatora
    </Link>
    <UserMenu />
  </div>
</Show>
```

- [ ] **Step 5: Verify**

Open: `http://localhost:3000/`. The top nav now shows `Pomoc | Zaloguj się | Wypróbuj za darmo` (or `Pomoc | Panel organizatora | <avatar>` if logged in). Clicking `Pomoc` lands on `/pomoc`.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(pomoc): add Pomoc link to landing nav"
```

---

## Task 18: Add `Pomoc` link to dashboard sidebar

**Files:**
- Modify: [src/components/dashboard/Sidebar.tsx](src/components/dashboard/Sidebar.tsx)

Add a secondary `Pomoc` link below the collapse toggle (NOT in the primary `NAV_ITEMS` array — we don't want to crowd the 4 primary items). Should be subtle, like a tertiary link, but still visibly tappable (per the persona memory: no `text-xs` for actions).

- [ ] **Step 1: Open [src/components/dashboard/Sidebar.tsx](src/components/dashboard/Sidebar.tsx) and find the "Collapse toggle" `<button>` block (around line 155–177)**

Current code:

```tsx
<button
  onClick={toggle}
  className={`mx-3 mt-4 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition-all hover:border-white/20 hover:bg-white/8 hover:text-white/70 ${
    collapsed ? "justify-center px-0 mx-2 border-transparent" : ""
  }`}
  aria-label={collapsed ? "Rozwiń panel" : "Zwiń panel"}
>
  {/* …chevron SVG… */}
  {!collapsed && <span>Zwiń panel</span>}
</button>

{/* User menu */}
<div className={`mt-auto border-t border-white/10 px-4 py-3 ${...}`}>
  <UserMenu dropUp />
</div>
```

- [ ] **Step 2: Insert a `Pomoc` `<Link>` between the collapse toggle and the user menu**

Add this block immediately AFTER the closing `</button>` of the collapse toggle and BEFORE the `{/* User menu */}` div:

```tsx
<Link
  href="/pomoc"
  className={`mx-3 mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all duration-150 ${
    pathname.startsWith("/pomoc")
      ? "bg-white/12 font-semibold text-white"
      : "text-white/60 hover:bg-white/8 hover:text-white/80"
  } ${collapsed ? "mx-2 justify-center px-0" : ""}`}
  title={collapsed ? "Pomoc" : undefined}
  aria-current={pathname.startsWith("/pomoc") ? "page" : undefined}
>
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className="shrink-0"
  >
    <circle cx="9" cy="9" r="7" />
    <path d="M7.2 6.8a1.9 1.9 0 013.8 0c0 1.2-1.9 1.5-1.9 3M9 13h.01" />
  </svg>
  {!collapsed && <span>Pomoc</span>}
</Link>
```

- [ ] **Step 3: Verify the imports**

`Link` is already imported at the top of the file (`import Link from "next/link";`). `pathname` is already in scope (it's declared in `Sidebar`'s body via `usePathname()`). No new imports needed.

- [ ] **Step 4: Verify visually**

Run: `pnpm dev`
Open: `http://localhost:3000/dashboard` (must be signed in). Look at the sidebar — there should be a `Pomoc` link below the *Zwiń panel* button. Hover and tap.
Then navigate to `http://localhost:3000/pomoc` — the `Pomoc` link in the sidebar should now have the active state (`bg-white/12` + bold).
Toggle the sidebar collapse — link collapses to icon-only with tooltip.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/Sidebar.tsx
git commit -m "feat(pomoc): add Pomoc link to dashboard sidebar"
```

---

## Task 19: Add `/pomoc/*` URLs to sitemap

**Files:**
- Modify: [src/app/sitemap.ts](src/app/sitemap.ts)

Add the hub + 8 topic pages between the existing static pages and the dynamic event entries. Use the registry as the source of truth so adding/removing a topic in `topics.ts` automatically updates the sitemap.

- [ ] **Step 1: Open [src/app/sitemap.ts](src/app/sitemap.ts)**

The current `staticPages` const has 3 entries (home, regulamin, polityka-prywatnosci).

- [ ] **Step 2: Import the topic registry at the top of the file**

After the existing imports, add:

```ts
import { TOPICS } from "@/lib/docs/topics";
```

- [ ] **Step 3: Add the docs pages to the sitemap**

Inside the `sitemap` function, immediately after the `staticPages` const is declared and before the `eventPages` const, add:

```ts
const docsPages: MetadataRoute.Sitemap = [
  {
    url: `${base}/pomoc`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  },
  ...TOPICS.map((topic) => ({
    url: `${base}/pomoc/${topic.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  })),
];
```

- [ ] **Step 4: Include `docsPages` in the returned array**

Find the `return` statement at the bottom of the function:

```ts
return [
  ...staticPages,
  ...eventPages,
];
```

Replace with:

```ts
return [
  ...staticPages,
  ...docsPages,
  ...eventPages,
];
```

- [ ] **Step 5: Verify**

Run: `pnpm dev`
Open: `http://localhost:3000/sitemap.xml`
Expected: the response contains 9 new `<url>` entries — `/pomoc` and all 8 `/pomoc/<slug>` URLs. Verify the slugs match those in `TOPICS`.

- [ ] **Step 6: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(pomoc): add /pomoc pages to sitemap"
```

---

## Task 20: Final verification

End-to-end check that everything works together. No new files, no new commits unless something is broken.

- [ ] **Step 1: Run unit tests**

Run: `pnpm test`
Expected: all tests pass, including the new `src/lib/docs/topics.test.ts` (8 cases).

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no errors. Warnings about unrelated existing files are acceptable.

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: builds successfully. All `/pomoc/*` pages should appear in the build output as static routes (`○`). No build-time errors about missing imports, bad metadata, or invalid JSON-LD.

- [ ] **Step 4: Click-through with `pnpm dev`**

Run: `pnpm dev` and open `http://localhost:3000`.

For each item below, click through and verify:

- [ ] Landing nav (signed-out): `Pomoc` link visible left of `Zaloguj się`. Clicking lands on `/pomoc`.
- [ ] `/pomoc` hub: renders title "Jak korzystać z Wyjazdo", shows 8 cards including the wide `Co to jest Wyjazdo i jak działa` card on top and the wide `FAQ` card at the bottom. Each card's link works.
- [ ] Each of the 8 topic pages renders: breadcrumb back to `/pomoc`, H1 matches the registry title, body content visible, no React or hydration warnings in the browser console.
- [ ] Every topic page has a `Co dalej?` footer with 2–3 related cards. Each links to a sibling.
- [ ] View page source of `/pomoc/faq` — confirm there's a `<script type="application/ld+json">` block containing `"@type": "FAQPage"` and all 8 questions.
- [ ] View page source of `/pomoc/co-to-jest` — confirm there's an `Article` JSON-LD block and a `BreadcrumbList` block.
- [ ] Sign in. The landing nav now shows `Pomoc | Panel organizatora | <avatar>`. Clicking `Panel organizatora` goes to `/dashboard`.
- [ ] In the dashboard sidebar, `Pomoc` link is visible below the collapse-toggle button. Click — lands on `/pomoc`. Back on `/dashboard`, the link is in its inactive state; on `/pomoc/<anything>`, the link has the active state (bold + `bg-white/12`).
- [ ] Toggle the sidebar collapse — the `Pomoc` link collapses to icon-only.
- [ ] Open `http://localhost:3000/sitemap.xml` — verify 9 new URLs are present.
- [ ] Spot-check mobile (resize browser to 375px): hub cards stack to single column, layout chrome is readable, no horizontal scroll.

- [ ] **Step 5: Polish & casing sanity check**

Open any topic page and skim. Confirm:
- No English words that aren't proper nouns (Stripe, BLIK, Przelewy24, Visa, Mastercard, Apple Pay, Google Pay, Facebook, Instagram, WhatsApp, Messenger, CSV are all OK).
- No `text-xs` on anything clickable.
- No `Cię` / `Tobie` / `Twój` casing mistakes that would indicate gender-flipped phrasing leaking in.

- [ ] **Step 6: (Optional) follow-up notes**

If you find anything missing while clicking through, write it up in a follow-up issue — don't fold it into this PR.

- [ ] **Step 7: Final summary commit (only if needed)**

If steps 1–4 surfaced any bugs that needed fixing, commit those fixes with a clear message before opening the PR. Otherwise, no commit needed at this step.

---

## Summary checklist (for the PR description)

- [ ] 8 topic pages live under `/pomoc/*`, plus hub at `/pomoc`.
- [ ] `Pomoc` link in landing nav (signed-out and signed-in).
- [ ] `Pomoc` link in dashboard sidebar with active-state highlighting.
- [ ] All 9 `/pomoc` URLs in `sitemap.xml`.
- [ ] `Article` + `BreadcrumbList` JSON-LD on every topic page.
- [ ] `FAQPage` JSON-LD on `/pomoc/faq`.
- [ ] `WebPage` + `BreadcrumbList` JSON-LD on `/pomoc` hub.
- [ ] Every page has unique `<title>`, `<meta description>`, and `canonical`.
- [ ] All copy is in Polish, in feminine singular direct address, using dashboard terminology.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` all clean.

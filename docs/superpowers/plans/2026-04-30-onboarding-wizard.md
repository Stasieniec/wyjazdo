# Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page onboarding form with a multi-step wizard at a new `/onboarding` route — full-screen, step-by-step, mobile-bug-fixed, with subdomain auto-suggested from display name.

**Architecture:** One client component (`OnboardingWizard.tsx`) holds all wizard state across 6 steps (welcome + 5 input). Final submit calls the existing server action (moved to `src/app/onboarding/actions.ts`) with `jumpToStep` added to its error shape so the wizard can return the user to the offending step. Visual shell (`WizardShell.tsx`) provides the blob background, step pill, and progress bar. Slug auto-suggestion lives in `src/lib/utils/slug.ts` with full unit-test coverage. The new route is at `/onboarding` (root, outside `dashboard/`) so it bypasses `DashboardLayout` and renders fully full-screen.

**Tech Stack:** Next.js 16 App Router, React 19 (`useActionState`, `useState`), Clerk (auth + `<SignUp />`), Zod (validation, unchanged), Tailwind v4 (styling), vitest (unit tests).

**Spec:** [docs/superpowers/specs/2026-04-30-onboarding-wizard-design.md](../specs/2026-04-30-onboarding-wizard-design.md)

---

## Task 1: Slug utility (TDD)

**Files:**
- Create: `src/lib/utils/slug.ts`
- Test: `src/lib/utils/slug.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/utils/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases ASCII", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips Polish diacritics via NFD", () => {
    expect(slugify("Górskie Wyjazdy")).toBe("gorskie-wyjazdy");
    expect(slugify("Anna Lęcka — Retreaty")).toBe("anna-lecka-retreaty");
  });

  it("maps ł and Ł to l (NFD does not handle these)", () => {
    expect(slugify("Łódź")).toBe("lodz");
    expect(slugify("Anna Łęcka")).toBe("anna-lecka");
  });

  it("collapses runs of non-alphanumerics to a single dash", () => {
    expect(slugify("Mountain & Soul!!! 2024")).toBe("mountain-soul-2024");
    expect(slugify("a   b")).toBe("a-b");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("---hello---")).toBe("hello");
    expect(slugify("  spaced  ")).toBe("spaced");
  });

  it("returns an empty string for empty / dash-only / emoji-only input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
    expect(slugify("---")).toBe("");
    expect(slugify("🎉🌄")).toBe("");
  });

  it("truncates to 32 chars at a dash boundary when possible", () => {
    // 38 chars after slugify; nearest dash before 32 should win.
    const result = slugify("Anna Lecka Retreaty Gorskie Wyjazdy 2024");
    expect(result.length).toBeLessThanOrEqual(32);
    expect(result.endsWith("-")).toBe(false);
    expect(result).toBe("anna-lecka-retreaty-gorskie");
  });

  it("hard-cuts at 32 if no dash boundary is available", () => {
    const result = slugify("a".repeat(40));
    expect(result.length).toBe(32);
    expect(result).toBe("a".repeat(32));
  });

  it("preserves digits", () => {
    expect(slugify("Wyjazd 2024")).toBe("wyjazd-2024");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- slug`
Expected: FAIL — "Cannot find module './slug'" or similar.

- [ ] **Step 3: Implement `slugify`**

Create `src/lib/utils/slug.ts`:

```ts
const MAX_LEN = 32;

export function slugify(input: string): string {
  if (!input) return "";

  // 1. NFD normalize and strip combining marks (handles ó, ą, ę, etc.)
  let s = input.normalize("NFD").replace(/[̀-ͯ]/g, "");

  // 2. Polish-specific chars that don't decompose under NFD
  s = s.replace(/ł/g, "l").replace(/Ł/g, "l");

  // 3. Lowercase
  s = s.toLowerCase();

  // 4. Replace runs of non-alphanumerics with a single dash
  s = s.replace(/[^a-z0-9]+/g, "-");

  // 5. Trim leading/trailing dashes
  s = s.replace(/^-+|-+$/g, "");

  if (s.length <= MAX_LEN) return s;

  // 6. Truncate at a dash boundary if one exists at or before MAX_LEN
  const truncated = s.slice(0, MAX_LEN);
  const lastDash = truncated.lastIndexOf("-");
  if (lastDash > 0) return truncated.slice(0, lastDash);
  return truncated;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- slug`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/slug.ts src/lib/utils/slug.test.ts
git commit -m "feat(slug): add slugify utility with Polish diacritic handling"
```

---

## Task 2: Sign-up auto-redirect

**Files:**
- Modify: `src/app/sign-up/[[...rest]]/page.tsx`

- [ ] **Step 1: Add `forceRedirectUrl` props to `<SignUp />`**

Replace the `<SignUp />` line in `src/app/sign-up/[[...rest]]/page.tsx` (line 13) with:

```tsx
<SignUp forceRedirectUrl="/onboarding" signInForceRedirectUrl="/dashboard" />
```

Final file contents should be:

```tsx
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link
        href="/"
        className="mb-6 text-xl font-bold tracking-tight text-primary"
      >
        wyjazdo
      </Link>
      <SignUp forceRedirectUrl="/onboarding" signInForceRedirectUrl="/dashboard" />
      <p className="mt-6 text-xs text-muted-foreground">
        Masz już konto?{" "}
        <Link href="/sign-in" className="font-medium text-foreground hover:underline">
          Zaloguj się
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify the build still type-checks**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sign-up/[[...rest]]/page.tsx
git commit -m "feat(signup): force redirect new accounts to /onboarding"
```

---

## Task 3: Move actions to new `/onboarding` route, add `jumpToStep`

**Files:**
- Create: `src/app/onboarding/actions.ts`
- Delete (later in Task 16): `src/app/dashboard/onboarding/actions.ts`

We move and modify the action in one task to keep it atomic. The dashboard version is deleted later (Task 16) only after the wizard is fully wired up so the old form keeps working until the end.

- [ ] **Step 1: Create the new `actions.ts`**

Create `src/app/onboarding/actions.ts`:

```ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { organizerProfileSchema } from "@/lib/validators/organizer";
import { newId } from "@/lib/ids";
import {
  createOrganizer,
  getOrganizerByClerkUserId,
  isSubdomainTaken,
} from "@/lib/db/queries/organizers";
import { getLatestDocument, insertOrganizerConsent } from "@/lib/db/queries/legal";

export type CreateOrganizerResult =
  | { error: string; jumpToStep?: number }
  | { errors: Record<string, string>; jumpToStep?: number }
  | undefined;

// Map a field name to the wizard step index that owns that field.
// state.step indexing: 0=welcome, 1=name, 2=subdomain, 3=email, 4=description, 5=consents.
const FIELD_TO_STEP: Record<string, number> = {
  displayName: 1,
  subdomain: 2,
  contactEmail: 3,
  description: 4,
  acceptTerms: 5,
  acceptPrivacy: 5,
  acceptDpa: 5,
};

export async function createOrganizerAction(formData: FormData): Promise<CreateOrganizerResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existing = await getOrganizerByClerkUserId(userId);
  if (existing) redirect("/dashboard");

  const subdomainRaw = String(formData.get("subdomain") ?? "").toLowerCase();

  const parsed = organizerProfileSchema.safeParse({
    subdomain: subdomainRaw,
    displayName: String(formData.get("displayName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? "").trim(),
    description: (formData.get("description") as string) || undefined,
    acceptTerms: formData.get("acceptTerms") === "true" ? true : false,
    acceptPrivacy: formData.get("acceptPrivacy") === "true" ? true : false,
    acceptDpa: formData.get("acceptDpa") === "true" ? true : false,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    let firstField: string | null = null;
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_form");
      if (!errors[key]) {
        errors[key] = issue.message;
        if (!firstField) firstField = key;
      }
    }
    const jumpToStep = firstField ? FIELD_TO_STEP[firstField] : undefined;
    return { errors, jumpToStep };
  }

  if (await isSubdomainTaken(parsed.data.subdomain)) {
    return { error: "Ten adres jest już zajęty — spróbuj inny", jumpToStep: 2 };
  }

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const now = Date.now();
  const organizerId = newId();

  await createOrganizer({
    id: organizerId,
    clerkUserId: userId,
    subdomain: parsed.data.subdomain,
    displayName: parsed.data.displayName,
    description: parsed.data.description ?? null,
    contactEmail: parsed.data.contactEmail,
    termsAcceptedAt: now,
    dpaAcceptedAt: now,
  });

  // Record consent audit trail (best-effort -- don't block onboarding if docs not seeded yet)
  const [regulamin, privacyPolicy, dpa] = await Promise.all([
    getLatestDocument("regulamin"),
    getLatestDocument("privacy_policy"),
    getLatestDocument("dpa"),
  ]);

  const consentPromises: Promise<void>[] = [];
  if (regulamin) {
    consentPromises.push(insertOrganizerConsent({ organizerId, documentId: regulamin.id, ipAddress: ip }));
  }
  if (privacyPolicy) {
    consentPromises.push(insertOrganizerConsent({ organizerId, documentId: privacyPolicy.id, ipAddress: ip }));
  }
  if (dpa) {
    consentPromises.push(insertOrganizerConsent({ organizerId, documentId: dpa.id, ipAddress: ip }));
  }
  await Promise.allSettled(consentPromises);

  redirect("/dashboard");
}
```

The differences from the existing `src/app/dashboard/onboarding/actions.ts`:
1. Returns `{ errors, jumpToStep }` instead of `{ errors }` — the wizard reads `jumpToStep` to navigate back. `jumpToStep` is computed from `FIELD_TO_STEP` using the first-failing-field's name.
2. Returns `jumpToStep: 2` for the "subdomain already taken" case with a slightly friendlier message ("spróbuj inny" suffix). The reserved-subdomain check stays in the existing Zod schema's `refine` and surfaces the same way as any other field error (so it goes through the `errors` path with `jumpToStep: 2`).

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors. (The action is not yet imported anywhere, but the file itself must compile.)

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/actions.ts
git commit -m "feat(onboarding): new server action with jumpToStep error routing"
```

---

## Task 4: Onboarding route with minimal layout + page

**Files:**
- Create: `src/app/onboarding/layout.tsx`
- Create: `src/app/onboarding/page.tsx`

The layout is intentionally minimal — no nav, no sidebar. The page server-side fetches Clerk user data and redirects already-onboarded users away.

- [ ] **Step 1: Create the layout**

Create `src/app/onboarding/layout.tsx`:

```tsx
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen w-full">{children}</div>;
}
```

- [ ] **Step 2: Create the page (renders a placeholder for now)**

Create `src/app/onboarding/page.tsx`:

```tsx
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existing = await getOrganizerByClerkUserId(userId);
  if (existing) redirect("/dashboard");

  const user = await currentUser();
  const firstName = user?.firstName ?? null;
  const defaultContactEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";

  return <OnboardingWizard firstName={firstName} defaultContactEmail={defaultContactEmail} />;
}
```

- [ ] **Step 3: Create a stub `OnboardingWizard` so the page compiles**

Create `src/app/onboarding/OnboardingWizard.tsx`:

```tsx
"use client";

type Props = {
  firstName: string | null;
  defaultContactEmail: string;
};

export function OnboardingWizard({ firstName, defaultContactEmail }: Props) {
  return (
    <div className="p-8">
      <p>Wizard placeholder — firstName: {firstName ?? "(none)"}, email: {defaultContactEmail}</p>
    </div>
  );
}
```

- [ ] **Step 4: Update middleware to protect `/onboarding`**

Modify `src/middleware.ts` line 6:

Replace:

```ts
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
```

With:

```ts
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/onboarding(.*)"]);
```

And update the reference on line 21 from `isDashboardRoute(req)` to `isProtectedRoute(req)`.

Final relevant section of `src/middleware.ts`:

```ts
const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get("host") ?? "";
  const tenant = resolveTenant(host, ROOT);
  const url = req.nextUrl.clone();

  if (tenant.kind === "tenant") {
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next")) {
      return NextResponse.next();
    }
    url.pathname = `/sites/${tenant.subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  return NextResponse.next();
});
```

- [ ] **Step 5: Verify the new route loads**

Run: `npm run dev` (in a separate terminal if needed)
Visit `http://localhost:3000/onboarding` while signed in (without an organizer). Confirm the placeholder text renders.

- [ ] **Step 6: Commit**

```bash
git add src/app/onboarding/layout.tsx src/app/onboarding/page.tsx src/app/onboarding/OnboardingWizard.tsx src/middleware.ts
git commit -m "feat(onboarding): scaffold /onboarding route with auth guard"
```

---

## Task 5: WizardShell visual scaffold

**Files:**
- Create: `src/app/onboarding/WizardShell.tsx`

This is the visual frame: blob background, top step pill + progress bar, bottom CTA area. Steps render their content into the middle slot.

- [ ] **Step 1: Create `WizardShell.tsx`**

Create `src/app/onboarding/WizardShell.tsx`:

```tsx
"use client";

import { type ReactNode } from "react";

type Props = {
  /** Current input-step number, 1..5. Pass null for the welcome screen (no pill). */
  currentStep: number | null;
  /** Total number of input steps. */
  totalSteps: number;
  children: ReactNode;
};

export function WizardShell({ currentStep, totalSteps, children }: Props) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#FFF8F4]">
      {/* Coral blob — top right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 h-[340px] w-[340px] rounded-full blur-[2px] md:-top-48 md:-right-40 md:h-[540px] md:w-[540px]"
        style={{
          background:
            "radial-gradient(circle, rgba(232,104,58,0.33) 0%, rgba(232,104,58,0.13) 40%, transparent 70%)",
        }}
      />
      {/* Navy blob — bottom left */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 h-[280px] w-[280px] rounded-full blur-[2px] md:-bottom-48 md:-left-40 md:h-[460px] md:w-[460px]"
        style={{
          background:
            "radial-gradient(circle, rgba(30,58,95,0.20) 0%, rgba(30,58,95,0.07) 40%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-6 py-8 md:max-w-[560px] md:px-8 md:py-12 md:justify-center">
        {currentStep !== null && (
          <header className="flex flex-col gap-3" aria-live="polite">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-[#1E3A5F] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8683A]" />
              Krok {currentStep} z {totalSteps}
            </span>
            <ol className="flex gap-1.5" aria-label="Postęp">
              {Array.from({ length: totalSteps }).map((_, i) => {
                const idx = i + 1;
                const state = idx < currentStep ? "done" : idx === currentStep ? "current" : "pending";
                const bg =
                  state === "done"
                    ? "bg-[#1E3A5F]"
                    : state === "current"
                      ? "bg-[#E8683A]"
                      : "bg-[#F4E5DC]";
                return <li key={idx} className={`h-1 flex-1 rounded-full ${bg}`} />;
              })}
            </ol>
          </header>
        )}

        <div className="mt-10 flex flex-1 flex-col md:mt-12">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the shell renders standalone**

Temporarily edit `src/app/onboarding/OnboardingWizard.tsx` to render the shell with placeholder content:

```tsx
"use client";

import { WizardShell } from "./WizardShell";

type Props = { firstName: string | null; defaultContactEmail: string };

export function OnboardingWizard(_: Props) {
  return (
    <WizardShell currentStep={2} totalSteps={5}>
      <h1 className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] md:text-4xl">
        Test heading
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">Test hint</p>
    </WizardShell>
  );
}
```

Run: `npm run dev`. Visit `/onboarding`. Confirm: cream background, blobs in corners, navy step pill "KROK 2 Z 5", 5-segment progress bar with one "done" + one "current" + three pending, content centered on desktop / top-anchored on mobile.

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/WizardShell.tsx src/app/onboarding/OnboardingWizard.tsx
git commit -m "feat(onboarding): visual shell with blob background and progress"
```

---

## Task 6: StepWelcome component

**Files:**
- Create: `src/app/onboarding/steps/StepWelcome.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/onboarding/steps/StepWelcome.tsx`:

```tsx
"use client";

type Props = {
  firstName: string | null;
  onStart: () => void;
};

const ITEMS = [
  "Nazwa i adres strony",
  "Email kontaktowy",
  "Krótki opis (opcjonalnie)",
  "Zgody i dokumenty",
];

export function StepWelcome({ firstName, onStart }: Props) {
  const greeting = firstName ? `Cześć ${firstName}!` : "Cześć!";
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-5xl">👋</div>
      <h1
        tabIndex={-1}
        className="mt-5 text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        {greeting} Skonfigurujmy Twoją stronę zapisów.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Zajmie to około 2 minuty. Krok po kroku przygotujemy wszystko, czego potrzebujesz.
      </p>

      <ul className="mt-6 flex flex-col gap-2.5">
        {ITEMS.map((item, i) => (
          <li key={item} className="flex items-center gap-3 text-sm font-medium text-[#1E3A5F] md:text-base">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-[#1E3A5F] text-xs font-bold text-white">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-10">
        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] md:max-w-xs"
        >
          Zaczynamy →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/onboarding/steps/StepWelcome.tsx
git commit -m "feat(onboarding): welcome step component"
```

---

## Task 7: StepName component

**Files:**
- Create: `src/app/onboarding/steps/StepName.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/onboarding/steps/StepName.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  onBack: () => void;
  onNext: () => void;
};

export function StepName({ value, onChange, error, onBack, onNext }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        Jak nazywa się Twoja firma?
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Tak będzie wyświetlana na stronie zapisów dla uczestników.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#DC2626]"
        >
          {error}
        </p>
      )}

      <div className="mt-7 rounded-2xl bg-white p-5 shadow-[0_12px_32px_rgba(30,58,95,0.10),0_2px_4px_rgba(30,58,95,0.04)]">
        <label
          htmlFor="onboarding-displayName"
          className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280]"
        >
          Nazwa
        </label>
        <input
          id="onboarding-displayName"
          name="displayName"
          type="text"
          autoComplete="organization"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={100}
          placeholder="np. Górskie Wyjazdy"
          className="mt-1.5 block w-full border-0 border-b-2 border-[#E5E7EB] bg-transparent px-0 py-2 text-lg font-medium text-[#1E3A5F] outline-none placeholder:text-[#B0B5BC] focus:border-[#E8683A] md:text-xl"
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
        <button
          type="submit"
          className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] md:flex-1"
        >
          Dalej →
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] md:w-auto"
        >
          ← Wstecz
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/onboarding/steps/StepName.tsx
git commit -m "feat(onboarding): displayName step component"
```

---

## Task 8: StepSubdomain component

**Files:**
- Create: `src/app/onboarding/steps/StepSubdomain.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/onboarding/steps/StepSubdomain.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  onBack: () => void;
  onNext: () => void;
};

const ROOT_DOMAIN = "wyjazdo.pl";

/** Live-sanitize as user types: lowercase, ASCII-only, dashes for invalid runs. */
function sanitize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9-]+/g, "-")
    .slice(0, 32);
}

export function StepSubdomain({ value, onChange, error, onBack, onNext }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const previewSlug = value.replace(/^-+|-+$/g, "") || "twoja-nazwa";

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        Twój adres do zapisów
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Krótki adres, który będziesz wysyłać uczestnikom — sugerujemy go na podstawie nazwy.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#DC2626]"
        >
          {error}
        </p>
      )}

      <div className="mt-7 rounded-2xl bg-white p-5 shadow-[0_12px_32px_rgba(30,58,95,0.10),0_2px_4px_rgba(30,58,95,0.04)]">
        <label
          htmlFor="onboarding-subdomain"
          className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280]"
        >
          Adres
        </label>
        <input
          id="onboarding-subdomain"
          name="subdomain"
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          placeholder="gorskie-wyjazdy"
          className="mt-1.5 block w-full border-0 border-b-2 border-[#E5E7EB] bg-transparent px-0 py-2 text-lg font-medium text-[#1E3A5F] outline-none placeholder:text-[#B0B5BC] focus:border-[#E8683A] md:text-xl"
        />
        <p className="mt-3 text-xs text-[#6B7280]">
          Twoja strona:{" "}
          <code className="rounded border border-[#F4E5DC] bg-[#FFF8F4] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#1E3A5F]">
            {previewSlug}.{ROOT_DOMAIN}
          </code>
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-[#F4E5DC] bg-white/70 px-4 py-3 text-xs leading-relaxed text-[#6B7280]">
        <strong className="text-[#1E3A5F]">Co to jest?</strong> Każdy organizator ma własny adres
        — tam uczestnicy zapisują się na Twoje wyjazdy. Wybieraj rozważnie: zmiana po założeniu
        konta jest możliwa, ale link, który już wyślesz uczestnikom, przestanie działać.
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
        <button
          type="submit"
          className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] md:flex-1"
        >
          Dalej →
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] md:w-auto"
        >
          ← Wstecz
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/onboarding/steps/StepSubdomain.tsx
git commit -m "feat(onboarding): subdomain step with live preview and explainer"
```

---

## Task 9: StepEmail component

**Files:**
- Create: `src/app/onboarding/steps/StepEmail.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/onboarding/steps/StepEmail.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  onBack: () => void;
  onNext: () => void;
};

export function StepEmail({ value, onChange, error, onBack, onNext }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        Gdzie wysyłać Ci powiadomienia?
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Tutaj dostaniesz wiadomość, gdy ktoś zapisze się na Twój wyjazd.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#DC2626]"
        >
          {error}
        </p>
      )}

      <div className="mt-7 rounded-2xl bg-white p-5 shadow-[0_12px_32px_rgba(30,58,95,0.10),0_2px_4px_rgba(30,58,95,0.04)]">
        <label
          htmlFor="onboarding-email"
          className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280]"
        >
          Email
        </label>
        <input
          id="onboarding-email"
          name="contactEmail"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={200}
          placeholder="anna@firma.pl"
          className="mt-1.5 block w-full border-0 border-b-2 border-[#E5E7EB] bg-transparent px-0 py-2 text-lg font-medium text-[#1E3A5F] outline-none placeholder:text-[#B0B5BC] focus:border-[#E8683A] md:text-xl"
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
        <button
          type="submit"
          className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] md:flex-1"
        >
          Dalej →
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] md:w-auto"
        >
          ← Wstecz
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/onboarding/steps/StepEmail.tsx
git commit -m "feat(onboarding): contact email step"
```

---

## Task 10: StepDescription component

**Files:**
- Create: `src/app/onboarding/steps/StepDescription.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/onboarding/steps/StepDescription.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  onBack: () => void;
  onNext: () => void;
};

export function StepDescription({ value, onChange, error, onBack, onNext }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        Opowiedz krótko o sobie
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Pojawi się na stronie zapisów. Ten krok jest opcjonalny — opis możesz dodać lub zmienić
        później w ustawieniach profilu.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#DC2626]"
        >
          {error}
        </p>
      )}

      <div className="mt-7 rounded-2xl bg-white p-5 shadow-[0_12px_32px_rgba(30,58,95,0.10),0_2px_4px_rgba(30,58,95,0.04)]">
        <label
          htmlFor="onboarding-description"
          className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280]"
        >
          Opis (opcjonalnie)
        </label>
        <textarea
          id="onboarding-description"
          name="description"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={2000}
          placeholder="Organizujemy kameralne wyjazdy w góry dla kobiet po 40-tce..."
          className="mt-1.5 block w-full resize-none rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm leading-relaxed text-[#1E3A5F] outline-none placeholder:text-[#B0B5BC] focus:border-[#E8683A]"
        />
        <p className="mt-2 text-right text-[11px] text-[#6B7280]">{value.length} / 2000</p>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
        <button
          type="submit"
          className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] md:flex-1"
        >
          {value.trim().length > 0 ? "Dalej →" : "Pomiń →"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] md:w-auto"
        >
          ← Wstecz
        </button>
      </div>
    </form>
  );
}
```

Note: there's a single primary CTA whose label changes between "Dalej →" (when there's text) and "Pomiń →" (when empty). This is simpler than two separate buttons and signals to the user that empty + clicking the button is fine.

- [ ] **Step 2: Commit**

```bash
git add src/app/onboarding/steps/StepDescription.tsx
git commit -m "feat(onboarding): optional description step"
```

---

## Task 11: StepConsents component

**Files:**
- Create: `src/app/onboarding/steps/StepConsents.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/onboarding/steps/StepConsents.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptDpa: boolean;
  onChange: (key: "acceptTerms" | "acceptPrivacy" | "acceptDpa", next: boolean) => void;
  onAcceptAll: () => void;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

export function StepConsents({
  acceptTerms,
  acceptPrivacy,
  acceptDpa,
  onChange,
  onAcceptAll,
  error,
  pending,
  onBack,
  onSubmit,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const allChecked = acceptTerms && acceptPrivacy && acceptDpa;

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) onSubmit();
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        Ostatni krok — dokumenty i zgody
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Wymagane przez RODO i regulamin serwisu.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#DC2626]"
        >
          {error}
        </p>
      )}

      <div className="mt-7 rounded-2xl bg-white p-5 shadow-[0_12px_32px_rgba(30,58,95,0.10),0_2px_4px_rgba(30,58,95,0.04)]">
        <button
          type="button"
          onClick={onAcceptAll}
          disabled={allChecked}
          className="mb-4 w-full rounded-lg border border-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] transition hover:bg-[#1E3A5F] hover:text-white disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:bg-[#F4F4F5] disabled:text-[#B0B5BC]"
        >
          {allChecked ? "✓ Wszystkie zgody zaznaczone" : "Zaakceptuj wszystkie"}
        </button>

        <ConsentRow
          id="acceptTerms"
          checked={acceptTerms}
          onChange={(v) => onChange("acceptTerms", v)}
        >
          Akceptuję{" "}
          <a
            href="/regulamin"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#1E3A5F] underline underline-offset-4 hover:text-[#E8683A]"
          >
            Regulamin serwisu wyjazdo.pl
          </a>
        </ConsentRow>
        <ConsentRow
          id="acceptPrivacy"
          checked={acceptPrivacy}
          onChange={(v) => onChange("acceptPrivacy", v)}
        >
          Zapoznałem/am się z{" "}
          <a
            href="/polityka-prywatnosci"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#1E3A5F] underline underline-offset-4 hover:text-[#E8683A]"
          >
            Polityką Prywatności
          </a>
        </ConsentRow>
        <ConsentRow
          id="acceptDpa"
          checked={acceptDpa}
          onChange={(v) => onChange("acceptDpa", v)}
        >
          Akceptuję{" "}
          <a
            href="/regulamin#umowa-powierzenia"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#1E3A5F] underline underline-offset-4 hover:text-[#E8683A]"
          >
            Umowę powierzenia przetwarzania danych osobowych
          </a>{" "}
          (art. 28 RODO)
        </ConsentRow>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
        <button
          type="submit"
          disabled={!allChecked || pending}
          className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#B0B5BC] disabled:shadow-none md:flex-1"
        >
          {pending ? "Tworzenie..." : "Utwórz profil →"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] disabled:opacity-50 md:w-auto"
        >
          ← Wstecz
        </button>
      </div>
    </form>
  );
}

function ConsentRow({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 py-2.5 text-sm leading-relaxed text-[#1E3A5F]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-[#E5E7EB] accent-[#1E3A5F]"
      />
      <span>{children}</span>
    </label>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/onboarding/steps/StepConsents.tsx
git commit -m "feat(onboarding): consents step with accept-all helper"
```

---

## Task 12: Wire it all together — `OnboardingWizard.tsx`

**Files:**
- Modify: `src/app/onboarding/OnboardingWizard.tsx`

This task replaces the placeholder with the full state machine.

- [ ] **Step 1: Replace `OnboardingWizard.tsx` with the full implementation**

Overwrite `src/app/onboarding/OnboardingWizard.tsx` with:

```tsx
"use client";

import { useState, useTransition } from "react";
import { createOrganizerAction } from "./actions";
import { slugify } from "@/lib/utils/slug";
import { WizardShell } from "./WizardShell";
import { StepWelcome } from "./steps/StepWelcome";
import { StepName } from "./steps/StepName";
import { StepSubdomain } from "./steps/StepSubdomain";
import { StepEmail } from "./steps/StepEmail";
import { StepDescription } from "./steps/StepDescription";
import { StepConsents } from "./steps/StepConsents";

type Props = {
  firstName: string | null;
  defaultContactEmail: string;
};

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;
const TOTAL_INPUT_STEPS = 5;

type FieldErrors = {
  displayName?: string;
  subdomain?: string;
  contactEmail?: string;
  description?: string;
  consents?: string;
};

// Map a step index to the FieldErrors key shown on that step's screen.
const STEP_TO_FIELD: Record<number, keyof FieldErrors> = {
  1: "displayName",
  2: "subdomain",
  3: "contactEmail",
  4: "description",
  5: "consents",
};

export function OnboardingWizard({ firstName, defaultContactEmail }: Props) {
  const [step, setStep] = useState<StepIndex>(0);
  const [displayName, setDisplayName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainEditedManually, setSubdomainEditedManually] = useState(false);
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [description, setDescription] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptDpa, setAcceptDpa] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function clearErrors() {
    setErrors({});
  }

  function goTo(next: StepIndex) {
    clearErrors();
    setStep(next);
  }

  function back() {
    if (step > 0) goTo((step - 1) as StepIndex);
  }

  // ----- Per-step "Dalej" handlers with client validation -----

  function handleNameNext() {
    const trimmed = displayName.trim();
    if (trimmed.length < 1) {
      setErrors({ displayName: "Wpisz nazwę swojej firmy" });
      return;
    }
    if (trimmed.length > 100) {
      setErrors({ displayName: "Nazwa może mieć maks. 100 znaków" });
      return;
    }
    // Auto-suggest subdomain if user hasn't edited it manually yet.
    if (!subdomainEditedManually) {
      setSubdomain(slugify(trimmed));
    }
    goTo(2);
  }

  function handleSubdomainChange(next: string) {
    setSubdomainEditedManually(true);
    setSubdomain(next);
  }

  function handleSubdomainNext() {
    const value = subdomain.trim();
    if (value.length < 3 || value.length > 32) {
      setErrors({ subdomain: "Adres musi mieć od 3 do 32 znaków" });
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)) {
      setErrors({ subdomain: "Adres może zawierać tylko małe litery, cyfry i myślniki" });
      return;
    }
    goTo(3);
  }

  function handleEmailNext() {
    const value = contactEmail.trim();
    // Pragmatic email regex: anything@anything.tld
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErrors({ contactEmail: "Wpisz prawidłowy adres email" });
      return;
    }
    if (value.length > 200) {
      setErrors({ contactEmail: "Email może mieć maks. 200 znaków" });
      return;
    }
    goTo(4);
  }

  function handleDescriptionNext() {
    if (description.length > 2000) {
      setErrors({ description: "Opis może mieć maks. 2000 znaków" });
      return;
    }
    goTo(5);
  }

  function handleConsentToggle(key: "acceptTerms" | "acceptPrivacy" | "acceptDpa", next: boolean) {
    if (key === "acceptTerms") setAcceptTerms(next);
    else if (key === "acceptPrivacy") setAcceptPrivacy(next);
    else setAcceptDpa(next);
    clearErrors();
  }

  function handleAcceptAll() {
    setAcceptTerms(true);
    setAcceptPrivacy(true);
    setAcceptDpa(true);
    clearErrors();
  }

  function handleSubmit() {
    if (!(acceptTerms && acceptPrivacy && acceptDpa)) {
      setErrors({ consents: "Aby kontynuować, zaakceptuj wszystkie zgody" });
      return;
    }
    clearErrors();

    startTransition(async () => {
      const fd = new FormData();
      fd.set("displayName", displayName.trim());
      fd.set("subdomain", subdomain.trim());
      fd.set("contactEmail", contactEmail.trim());
      fd.set("description", description.trim());
      fd.set("acceptTerms", acceptTerms ? "true" : "false");
      fd.set("acceptPrivacy", acceptPrivacy ? "true" : "false");
      fd.set("acceptDpa", acceptDpa ? "true" : "false");

      const result = await createOrganizerAction(fd);

      // On success, the action calls redirect() and this code is unreachable.
      if (!result) return;

      if ("errors" in result && result.errors) {
        const next: FieldErrors = {};
        if (result.errors.displayName) next.displayName = result.errors.displayName;
        if (result.errors.subdomain) next.subdomain = result.errors.subdomain;
        if (result.errors.contactEmail) next.contactEmail = result.errors.contactEmail;
        if (result.errors.description) next.description = result.errors.description;
        if (result.errors.acceptTerms || result.errors.acceptPrivacy || result.errors.acceptDpa) {
          next.consents =
            result.errors.acceptTerms ?? result.errors.acceptPrivacy ?? result.errors.acceptDpa;
        }
        setErrors(next);
        if (typeof result.jumpToStep === "number") setStep(result.jumpToStep as StepIndex);
        return;
      }

      if ("error" in result && result.error) {
        // Server returned a single top-level error with a step to jump to (e.g. subdomain taken).
        // Route the message to the field error of the target step so the relevant step renders it.
        const targetStep = typeof result.jumpToStep === "number" ? result.jumpToStep : 5;
        const field = STEP_TO_FIELD[targetStep] ?? "consents";
        setErrors({ [field]: result.error } as FieldErrors);
        setStep(targetStep as StepIndex);
        return;
      }
    });
  }

  // ----- Render the current step -----
  return (
    <WizardShell
      currentStep={step === 0 ? null : step}
      totalSteps={TOTAL_INPUT_STEPS}
    >
      {step === 0 && <StepWelcome firstName={firstName} onStart={() => goTo(1)} />}
      {step === 1 && (
        <StepName
          value={displayName}
          onChange={setDisplayName}
          error={errors.displayName ?? null}
          onBack={back}
          onNext={handleNameNext}
        />
      )}
      {step === 2 && (
        <StepSubdomain
          value={subdomain}
          onChange={handleSubdomainChange}
          error={errors.subdomain ?? null}
          onBack={back}
          onNext={handleSubdomainNext}
        />
      )}
      {step === 3 && (
        <StepEmail
          value={contactEmail}
          onChange={setContactEmail}
          error={errors.contactEmail ?? null}
          onBack={back}
          onNext={handleEmailNext}
        />
      )}
      {step === 4 && (
        <StepDescription
          value={description}
          onChange={setDescription}
          error={errors.description ?? null}
          onBack={back}
          onNext={handleDescriptionNext}
        />
      )}
      {step === 5 && (
        <StepConsents
          acceptTerms={acceptTerms}
          acceptPrivacy={acceptPrivacy}
          acceptDpa={acceptDpa}
          onChange={handleConsentToggle}
          onAcceptAll={handleAcceptAll}
          error={errors.consents ?? null}
          pending={pending}
          onBack={back}
          onSubmit={handleSubmit}
        />
      )}
    </WizardShell>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Smoke test in dev server**

Run: `npm run dev`. Visit `/onboarding` (signed in, no organizer). Walk through all 6 screens — confirm:
- Welcome → Name shows pill "Krok 1 z 5"
- Type "Górskie Wyjazdy" → Dalej; Subdomain step pre-fills with `gorskie-wyjazdy`
- Edit subdomain manually, go back, change name → subdomain stays as the manually-edited value
- Type bad email "foo" → click Dalej → see error "Wpisz prawidłowy adres email" inline
- Description: skip with empty value; CTA reads "Pomiń →"
- Consents: "Zaakceptuj wszystkie" toggles all three; "Utwórz profil" disabled until all checked
- Submit → redirects to `/dashboard` and an organizer row exists

If the dev DB is empty or the user already has an organizer, manually delete that organizer first or use a fresh user.

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding/OnboardingWizard.tsx
git commit -m "feat(onboarding): wire up wizard state machine and submit"
```

---

## Task 13: Update redirect call sites

**Files:**
- Modify: `src/app/dashboard/page.tsx:35`
- Modify: `src/app/dashboard/events/page.tsx:13`
- Modify: `src/app/dashboard/events/new/page.tsx:10`
- Modify: `src/app/dashboard/events/[id]/page.tsx:35`
- Modify: `src/app/dashboard/finance/page.tsx:27`
- Modify: `src/app/dashboard/settings/page.tsx:10`
- Modify: `src/app/dashboard/onboarding/payouts/page.tsx:22`

All seven sites currently call `redirect("/dashboard/onboarding")` to send users without an organizer back to do profile onboarding. Update each to `redirect("/onboarding")`.

- [ ] **Step 1: Update each file**

Use a single `sed`-style edit per file (or your editor's find-replace). The exact transformation is:

```
- redirect("/dashboard/onboarding");
+ redirect("/onboarding");
```

Apply to:
- `src/app/dashboard/page.tsx` (line 35)
- `src/app/dashboard/events/page.tsx` (line 13)
- `src/app/dashboard/events/new/page.tsx` (line 10)
- `src/app/dashboard/events/[id]/page.tsx` (line 35)
- `src/app/dashboard/finance/page.tsx` (line 27)
- `src/app/dashboard/settings/page.tsx` (line 10)
- `src/app/dashboard/onboarding/payouts/page.tsx` (line 22)

**Do NOT change** these — they reference the `/dashboard/onboarding/payouts` Stripe Connect flow, which stays under the dashboard layout:
- `src/app/dashboard/events/page.tsx:31` — `href="/dashboard/onboarding/payouts"`
- `src/app/dashboard/page.tsx:75` — `href="/dashboard/onboarding/payouts"`
- `src/app/dashboard/events/[id]/page.tsx:112` — `href="/dashboard/onboarding/payouts"`
- `src/app/dashboard/onboarding/payouts/page.tsx:35-36` — Stripe return/refresh URLs
- `src/app/dashboard/onboarding/payouts/return/page.tsx:18, 34, 35` — Stripe return URLs

- [ ] **Step 2: Verify all references are correctly partitioned**

Run:

```bash
grep -rn 'redirect("/dashboard/onboarding")' src
```

Expected: No matches.

Run:

```bash
grep -rn '"/dashboard/onboarding/payouts"' src
```

Expected: 5 or 6 matches — all in payouts-related code; verify each is intentional (an `href` link or a Stripe URL string).

Run:

```bash
grep -rn 'redirect("/onboarding")' src
```

Expected: 7 matches — the seven files updated above.

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/events/page.tsx src/app/dashboard/events/new/page.tsx src/app/dashboard/events/[id]/page.tsx src/app/dashboard/finance/page.tsx src/app/dashboard/settings/page.tsx src/app/dashboard/onboarding/payouts/page.tsx
git commit -m "refactor: redirect ungated dashboard routes to /onboarding"
```

---

## Task 14: Delete the old onboarding files

**Files:**
- Delete: `src/app/dashboard/onboarding/page.tsx`
- Delete: `src/app/dashboard/onboarding/OnboardingForm.tsx`
- Delete: `src/app/dashboard/onboarding/actions.ts`

The new wizard is fully wired up. The old form files are dead.

- [ ] **Step 1: Delete the three files**

```bash
rm src/app/dashboard/onboarding/page.tsx
rm src/app/dashboard/onboarding/OnboardingForm.tsx
rm src/app/dashboard/onboarding/actions.ts
```

The directory `src/app/dashboard/onboarding/` should still exist because of the `payouts/` subdirectory.

- [ ] **Step 2: Verify nothing else imports the deleted files**

Run:

```bash
grep -rn 'OnboardingForm' src
grep -rn 'dashboard/onboarding/actions' src
grep -rn 'from "./actions"' src/app/dashboard/onboarding/
```

Expected: No matches in any of the three.

- [ ] **Step 3: Verify type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/dashboard/onboarding/
git commit -m "refactor: remove legacy single-page onboarding form"
```

---

## Task 15: Verify everything together (manual test pass)

**Files:** None (verification only)

This is a deliberate gate before merging. Each item is a manual check.

- [ ] **Step 1: Sign-up auto-redirect**

  In an incognito window, go to `/sign-up`. Create a fresh test account with a real email + verification code. Confirm the URL after signup is `/onboarding`, **not** `/dashboard`.

- [ ] **Step 2: Full happy path on desktop**

  Walk through all 6 screens (welcome → name → subdomain → email → description → consents). At the consents step, click "Zaakceptuj wszystkie", then "Utwórz profil →". Confirm redirect to `/dashboard`. Confirm the organizer record was created (visible in the dashboard sidebar as the new subdomain).

- [ ] **Step 3: Full happy path on mobile**

  In Chrome DevTools or on a real device, repeat Step 2 at iPhone SE width (375px). Confirm:
  - All buttons reachable, tap targets ≥ 44px
  - Keyboard does not trigger silent submit failures
  - Inputs do not autocapitalize unintentionally on subdomain step
  - Pill, progress, headline, input, CTA all fit on screen

- [ ] **Step 4: Subdomain auto-suggest**

  Start a new flow. On step 2 type "Anna Łęcka & Retreaty 2024". Click Dalej. On step 3 confirm subdomain reads `anna-lecka-retreaty-2024` (no Polish chars, no symbols). Edit it manually to `test`. Go back. Change name to "Foo Bar". Go forward. Subdomain remains `test` (manual edit preserved).

- [ ] **Step 5: Server-side validation jumps back**

  Start a new flow. Use a subdomain you know is taken (or a reserved one like `app`). Complete all steps and submit. Confirm: wizard jumps back to step 2 (subdomain), shows red error message, all other entered data still present (email, consents, etc.).

- [ ] **Step 6: Already-onboarded user**

  Sign in as a user who already has an organizer. Manually navigate to `/onboarding`. Confirm immediate redirect to `/dashboard`.

- [ ] **Step 7: Run unit tests**

  Run: `npm test`
  Expected: All tests pass, including the 9 new slug tests.

- [ ] **Step 8: Run type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: No errors.

- [ ] **Step 9: Final commit (if any cleanup)**

  If the manual pass surfaced small fixes, commit them. Otherwise this task is verification-only, no commit needed.

---

## Done

The wizard is now live at `/onboarding`, replacing the single-page form. Sign-up flow lands users on it directly. The mobile bug is fixed (no HTML5 validation, live-sanitized subdomain, JS-only validation with visible inline errors). Subdomain auto-suggests from name with Polish character handling. The full screen aesthetic is preserved by living outside the dashboard layout.

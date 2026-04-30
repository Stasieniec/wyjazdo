# Onboarding Wizard — Design Spec

**Date:** 2026-04-30
**Status:** Approved (brainstorm) — pending implementation plan

## Goal

Replace the current single-page onboarding form with a step-by-step wizard tuned for the target audience: non-technical Polish women aged 40–50 who came from Google Forms and find tech intimidating. The redesign also fixes a mobile bug where the form appears to "do nothing and erase data," and improves the subdomain UX (auto-suggest from name, with plain-Polish explanation).

## Audience & visual direction

- Off-white background (`#FFF8F4`) with two large organic blobs in the corners — coral (top-right) and navy (bottom-left). Soft, friendly, "not-intimidating-tech."
- Bold headlines (30–38px), single decision per screen, prominent floating white card around input fields.
- Large coral CTA buttons with shadow for confidence.
- Brand colors: navy `#1E3A5F`, coral `#E8683A`. Typography: IBM Plex Sans (already in project).

The visual language was confirmed in brainstorming via mockups; reference files in `.superpowers/brainstorm/`.

## Step structure (6 screens, single submit)

| # | Step | Required input | Notes |
|---|---|---|---|
| 1 | Powitanie | none | Welcome + 4-item checklist preview, "Zaczynamy →" |
| 2 | Nazwa | `displayName` | "Jak nazywa się Twoja firma?" |
| 3 | Adres | `subdomain` | Auto-suggested from #2; live `*.wyjazdo.pl` preview; explainer card |
| 4 | Email | `contactEmail` | Pre-filled from Clerk; editable |
| 5 | Opis | `description` (optional) | "Pomiń" + "Dalej" CTAs; hint that profile is editable later in settings |
| 6 | Zgody | 3 consents | "Zaakceptuj wszystkie" convenience button; individual checkboxes also clickable; CTA disabled until all 3 are true |

After step 6 submission, the existing `redirect("/dashboard")` from `createOrganizerAction` kicks in. No celebration screen — keep momentum.

The progress pill and progress bar count input steps only (5 total). The welcome screen is a prelude and shows no counter. Numbering convention: pill text = `Krok ${state.step} z 5` where `state.step` is 1 (Nazwa) through 5 (Zgody). So the Nazwa screen shows "Krok 1 z 5", Adres shows "Krok 2 z 5", etc.

## Architecture

### Single client component holds all state

`OnboardingWizard.tsx` is a `"use client"` component containing one `useState` for the entire form payload and one for the current step index. No URL fragment per step, no localStorage — refresh resets the wizard, which is acceptable for a 2-minute flow with no sensitive persisted data.

State shape:

```ts
type WizardState = {
  step: 0 | 1 | 2 | 3 | 4 | 5;  // 0 = welcome, 5 = consents
  displayName: string;
  subdomain: string;
  subdomainEditedManually: boolean;
  contactEmail: string;
  description: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptDpa: boolean;
};
```

### Final submit reuses existing server action

The wizard's final "Utwórz profil" CTA submits all collected fields to `createOrganizerAction` in a single call. The existing Zod validation, subdomain-taken check, organizer creation, and consent audit trail are preserved verbatim.

The action's error return shape is extended slightly so the wizard can jump back to the relevant step:

```ts
// before: { error?: string; errors?: Record<string, string> }
// after:  { error?: string; errors?: Record<string, string>; jumpToStep?: number }
```

Server returns `jumpToStep: 2` on subdomain-taken or subdomain-invalid (matches step index for `subdomain`); the wizard reads this and animates back to that step with the error inline.

### File plan

**New:**
- `src/app/dashboard/onboarding/OnboardingWizard.tsx` — main component, state + step routing
- `src/app/dashboard/onboarding/WizardShell.tsx` — visual shell: blob background, pill, progress bar, step transition wrapper
- `src/app/dashboard/onboarding/steps/StepWelcome.tsx`
- `src/app/dashboard/onboarding/steps/StepName.tsx`
- `src/app/dashboard/onboarding/steps/StepSubdomain.tsx`
- `src/app/dashboard/onboarding/steps/StepEmail.tsx`
- `src/app/dashboard/onboarding/steps/StepDescription.tsx`
- `src/app/dashboard/onboarding/steps/StepConsents.tsx`
- `src/lib/utils/slug.ts` — slugify with Polish handling
- `src/lib/utils/slug.test.ts` — vitest tests

**Modified:**
- `src/app/dashboard/onboarding/page.tsx` — fetch `firstName` and `email` from Clerk via `currentUser()`, pass both to the wizard
- `src/app/dashboard/onboarding/actions.ts` — add `jumpToStep` to error return shape
- `src/app/sign-up/[[...rest]]/page.tsx` — add `forceRedirectUrl="/dashboard/onboarding"` on `<SignUp />`

**Deleted:**
- `src/app/dashboard/onboarding/OnboardingForm.tsx` — superseded by wizard

## Sign-up auto-redirect

Add to the Clerk `<SignUp />` element in `src/app/sign-up/[[...rest]]/page.tsx`:

```tsx
<SignUp
  forceRedirectUrl="/dashboard/onboarding"
  signInForceRedirectUrl="/dashboard"
/>
```

After signup, users land directly on the wizard. The existing `/dashboard/page.tsx` guard (redirects to `/dashboard/onboarding` if no organizer) remains as belt-and-suspenders.

## Mobile bug — root cause and fix

**Root cause:** The current form uses HTML5 `pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"` and `required` on inputs. On some mobile browsers (notably iOS Safari with autocorrect, certain Android keyboards) input can receive characters that fail the regex (uppercase autocomplete, trailing space, smart quotes). The browser silently blocks form submission with no visible error tooltip on mobile, the action callback never fires, and the user perceives "the button does nothing." The "data erased" perception is secondary: scrolling back up to a long form looks "fresh" to a non-technical user.

**Fix:**
1. **No HTML5 `pattern` or `required` attributes.** All validation is JavaScript, runs on each step's "Dalej" handler.
2. **Auto-sanitize subdomain on input.** The subdomain field's `onChange` lowercases, strips Polish diacritics and invalid chars in real time — invalid characters cannot be entered.
3. **Inline error above the input**, in coral with an icon and `role="alert"`. Always on screen because each step shows one input.
4. **Server errors jump back to the relevant step** via `jumpToStep`. No silent failure.
5. **Pending state on the final CTA** — disabled + spinner + "Tworzenie..." prevents double-submit.
6. **Sensible mobile keyboard hints** — `inputMode="email"` on the email step, `autoCapitalize="none"` on subdomain, `autoComplete` hints throughout.

## Slug auto-suggestion

`src/lib/utils/slug.ts` exports `slugify(input: string): string`:

```
slugify("Górskie Wyjazdy")              → "gorskie-wyjazdy"
slugify("Anna Łęcka — Retreaty 2024")   → "anna-lecka-retreaty-2024"
slugify("Mountain & Soul")              → "mountain-soul"
slugify("   ")                          → ""
```

Algorithm:
1. NFD normalize, strip combining marks (handles ó/á/é/ą/ę/etc.)
2. Manually map `ł→l` and `Ł→l` (these don't decompose under NFD)
3. Lowercase
4. Replace runs of non-`[a-z0-9]` with `-`
5. Trim leading/trailing `-`
6. Truncate to 32 chars at a `-` boundary if possible, else at 32

**Behavior in the wizard:**
- On each `displayName` change in step 2, recompute the suggestion.
- When advancing from step 2 to step 3, prefill `subdomain` *only if* `subdomainEditedManually` is false.
- If the user types in the subdomain field (step 3), set `subdomainEditedManually = true` — re-suggest is suppressed thereafter.
- If the auto-suggestion comes out empty (e.g., name was emoji-only), leave the subdomain field empty and let the user type.

## Validation rules per step

Client-side validation runs in each step's "Dalej" handler. Errors are inline with `role="alert"`. Final server-side validation in the existing Zod schema is unchanged.

| Step | Field | Rules | Error message |
|---|---|---|---|
| 2 | displayName | trim, length 1–100 | "Wpisz nazwę swojej firmy" |
| 3 | subdomain | length 3–32, regex `^[a-z0-9][a-z0-9-]*[a-z0-9]$` | "Adres musi mieć 3–32 znaków, tylko litery, cyfry i myślniki" |
| 4 | contactEmail | valid email format, max 200 | "Wpisz prawidłowy adres email" |
| 5 | description | max 2000, optional | "Opis może mieć maks. 2000 znaków" |
| 6 | acceptTerms, acceptPrivacy, acceptDpa | all true | "Aby kontynuować, zaakceptuj wszystkie zgody" |

The "Zaakceptuj wszystkie" button on step 6 sets all three booleans to true at once.

Reserved-subdomain check (e.g., `www`, `app`, `admin`) lives only on the server (existing Zod validator). On rejection the server returns `jumpToStep: 2` with the friendly message "Ten adres jest zarezerwowany — wybierz inny" — no need to mirror the reserved list to the client.

## Accessibility

- **Focus management:** on step transition, focus moves to the step's `<h1>` (which has `tabindex="-1"`). Screen readers announce the new step heading.
- **Step counter announced:** the "Krok N z 5" pill is wrapped in `aria-live="polite"`.
- **Real `<label>` per input** (not just placeholder). Labels are at least 14px and not the only marker; consents use icon + label.
- **Tap targets ≥ 44×44** for all buttons including back arrow and checkboxes.
- **Error messages with `role="alert"`** and a coral icon; never color-only.
- **Keyboard:** Enter advances on text inputs; Tab order is linear within each step; the back button has `aria-label="Wróć do poprzedniego kroku"`.
- **`prefers-reduced-motion`** respected — step slide-fade transitions become instant.
- **WCAG AA contrast:** navy text on cream and coral CTA on white both pass; verified with the existing `globals.css` palette.

## Responsive behavior

Single component, Tailwind breakpoints — no separate desktop component.

**Mobile (default):**
- Full-bleed background with corner blobs
- Vertical stack: pill → progress → headline → hint → input card → primary CTA → "← Wstecz" below
- Padding: `px-6 py-8`
- Headline: `text-3xl` (30px)

**Desktop (`md:` and up):**
- Same background, blobs scaled up via larger absolute sizes
- Content centered in a `max-w-[520px]` column
- Headline: `md:text-4xl` (38px)
- Buttons in a row: "← Wstecz" + "Dalej →" side-by-side at the bottom of the column
- Generous vertical centering: `md:justify-center`

## Going back, refresh, and edge cases

- **"← Wstecz"** simply decrements the step index. All field values are preserved in state; nothing is re-validated.
- **Refresh** loses state. Acceptable: 2-minute flow, no sensitive data persisted, GDPR-cleaner. Welcome step explains it'll take 2 minutes so users won't navigate away mid-flow.
- **Already-onboarded user lands on `/dashboard/onboarding`:** existing logic in `actions.ts` (`if (existing) redirect("/dashboard")`) handles the submit case; we add the same check at page load via `getOrganizerByClerkUserId(userId)` in `page.tsx` and redirect to `/dashboard` if found, so they never see the wizard a second time.
- **Subdomain race condition** (taken between client-check and server-check): server returns `error: "Ten adres jest już zajęty"` with `jumpToStep: 2`; wizard animates back to the Adres step with the error visible above the input.

## Out of scope

- Persisting wizard state to localStorage / resuming after refresh
- A/B testing different copy
- Adding more fields (avatar, banner image, social links — these belong in profile settings, after onboarding)
- Animation libraries beyond CSS transitions (e.g., Framer Motion) — not needed for slide-fade

## Testing

- **Unit tests** for `slugify` — Polish chars, edge cases (empty, emoji-only, long input), all 32-char boundary handling
- **Manual mobile testing** on iOS Safari and Android Chrome — confirm: no silent submission failures, autocorrect doesn't break subdomain, virtual keyboards present correct layouts
- **Manual desktop testing** — keyboard nav, focus visible on all interactive elements
- **Manual flow:** new signup → lands on wizard automatically → completes 6 steps → ends at dashboard with organizer record created

# Legal Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Polish legal compliance infrastructure to wyjazdo.pl -- consent tracking for organizers and participants, configurable per-event consents, and public legal document pages.

**Architecture:** Store legal documents as versioned rows in a `legal_documents` table. Track organizer acceptance at onboarding in `organizer_consents`. Store per-event consent configuration as a JSON column on `events` (same pattern as `customQuestions`). Track participant consent acceptance in `participant_consents` with full audit trail (timestamp, IP, document version). Public legal pages served from the DB.

**Tech Stack:** Drizzle ORM on Cloudflare D1/SQLite, Next.js (App Router), Zod validation, server actions, React `useActionState`.

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `src/lib/db/migrations/0002_legal_compliance.sql` | DDL: `legal_documents`, `organizer_consents`, `participant_consents` tables; `consent_config` column on `events`; `terms_accepted_at` + `dpa_accepted_at` on `organizers` |
| `src/lib/validators/consent.ts` | Zod schemas for `ConsentConfig` items and registration consent payload |
| `src/lib/legal/seed-documents.ts` | Script to insert/upsert initial legal document versions |
| `src/lib/db/queries/legal.ts` | CRUD for `legal_documents`, `organizer_consents`, `participant_consents` |
| `src/components/ui/Checkbox.tsx` | Reusable checkbox component matching existing UI kit |
| `src/components/dashboard/EventConsentsEditor.tsx` | Dashboard UI for configuring per-event consents |
| `src/components/sites/ConsentCheckboxes.tsx` | Participant-facing consent checkboxes on registration form |
| `src/app/(legal)/regulamin/page.tsx` | Public Terms of Service page |
| `src/app/(legal)/polityka-prywatnosci/page.tsx` | Public Privacy Policy page |
| `src/app/(legal)/layout.tsx` | Shared layout for legal pages (simple centered text) |

### Modified files

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Add `legalDocuments`, `organizerConsents`, `participantConsents` tables; add `consentConfig` column to `events`; add `termsAcceptedAt`, `dpaAcceptedAt` to `organizers` |
| `src/app/dashboard/onboarding/page.tsx` | Add consent checkboxes (regulamin, privacy policy, DPA) |
| `src/app/dashboard/onboarding/actions.ts` | Validate consent checkboxes, record acceptance timestamps |
| `src/lib/validators/organizer.ts` | Add consent acceptance fields to onboarding schema |
| `src/app/dashboard/events/[id]/EventEditForm.tsx` | Add "Zgody i regulaminy" section with `EventConsentsEditor` |
| `src/app/dashboard/events/[id]/actions.ts` | Parse and save `consentConfig` JSON on event save |
| `src/lib/validators/event.ts` | Add `consentConfigSchema` and include in `eventBaseSchema` |
| `src/app/sites/[subdomain]/[eventSlug]/register/RegisterForm.tsx` | Render `ConsentCheckboxes` after form fields |
| `src/app/sites/[subdomain]/[eventSlug]/register/page.tsx` | Load and pass consent config + legal doc versions to form |
| `src/lib/register/process-registration.ts` | Validate consent checkboxes, insert `participant_consents` rows |
| `src/lib/validators/registration.ts` | Add consent fields to registration schema |

---

## Task 1: Checkbox UI component

**Files:**
- Create: `src/components/ui/Checkbox.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Create the Checkbox component**

```tsx
// src/components/ui/Checkbox.tsx
import { type InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  error?: string;
}

export function Checkbox({ label, error, className = "", id, ...props }: CheckboxProps) {
  const inputId = id ?? props.name;
  return (
    <div>
      <label htmlFor={inputId} className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          id={inputId}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary ${error ? "accent-destructive" : ""} ${className}`}
          {...props}
        />
        <span className="text-foreground">{label}</span>
      </label>
      {error && <p className="mt-1 ml-7 text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Export from UI barrel**

In `src/components/ui/index.ts`, add:

```ts
export { Checkbox } from "./Checkbox";
```

- [ ] **Step 3: Verify build**

Run: `cd /home/stas/Desktop/wyjazdo && npx next build 2>&1 | tail -5`
Expected: Build succeeds (or at least no errors from the Checkbox file)

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Checkbox.tsx src/components/ui/index.ts
git commit -m "feat(ui): add Checkbox component for consent forms"
```

---

## Task 2: Consent config validator (Zod schemas)

**Files:**
- Create: `src/lib/validators/consent.ts`

- [ ] **Step 1: Create consent validators**

```ts
// src/lib/validators/consent.ts
import { z } from "zod";

/**
 * A single consent item configured by the organizer for an event.
 * Platform-required consents (regulamin, privacy) are NOT stored here --
 * they are always rendered and always mandatory.
 */
export const consentConfigItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  required: z.boolean(),
  category: z.enum(["general", "photo", "health", "marketing", "custom"]),
});
export type ConsentConfigItem = z.infer<typeof consentConfigItemSchema>;

export const consentConfigSchema = z.array(consentConfigItemSchema).max(20).default([]);

/**
 * Consent payload submitted by a participant during registration.
 * Keys are consent IDs, values are booleans.
 */
export const consentPayloadSchema = z.record(z.string(), z.boolean());
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validators/consent.ts
git commit -m "feat(validators): add Zod schemas for consent config and payload"
```

---

## Task 3: Database schema changes

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/migrations/0002_legal_compliance.sql`

- [ ] **Step 1: Add new tables and columns to Drizzle schema**

In `src/lib/db/schema.ts`, add **after** the `payments` table definition (before the type exports):

```ts
export const legalDocuments = sqliteTable("legal_documents", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: [
      "regulamin",
      "privacy_policy",
      "organizer_terms",
      "dpa",
      "cookie_policy",
    ],
  }).notNull(),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  effectiveAt: integer("effective_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const organizerConsents = sqliteTable(
  "organizer_consents",
  {
    id: text("id").primaryKey(),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => organizers.id),
    documentId: text("document_id")
      .notNull()
      .references(() => legalDocuments.id),
    acceptedAt: integer("accepted_at").notNull(),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    organizerIdx: index("organizer_consents_organizer_idx").on(t.organizerId),
  }),
);

export const participantConsents = sqliteTable(
  "participant_consents",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    consentKey: text("consent_key").notNull(),
    consentLabel: text("consent_label").notNull(),
    accepted: integer("accepted").notNull(),
    documentId: text("document_id"),
    acceptedAt: integer("accepted_at").notNull(),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    participantIdx: index("participant_consents_participant_idx").on(
      t.participantId,
    ),
  }),
);
```

- [ ] **Step 2: Add `consentConfig` column to `events` table**

In `src/lib/db/schema.ts`, in the `events` table definition, add after `balanceDueAt`:

```ts
    consentConfig: text("consent_config"),
```

- [ ] **Step 3: Add consent acceptance timestamps to `organizers` table**

In `src/lib/db/schema.ts`, in the `organizers` table definition, add after `updatedAt`:

```ts
    termsAcceptedAt: integer("terms_accepted_at"),
    dpaAcceptedAt: integer("dpa_accepted_at"),
```

- [ ] **Step 4: Add type exports**

At the bottom of `src/lib/db/schema.ts`, add:

```ts
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type NewLegalDocument = typeof legalDocuments.$inferInsert;
export type OrganizerConsent = typeof organizerConsents.$inferSelect;
export type NewOrganizerConsent = typeof organizerConsents.$inferInsert;
export type ParticipantConsent = typeof participantConsents.$inferSelect;
export type NewParticipantConsent = typeof participantConsents.$inferInsert;
```

- [ ] **Step 5: Create migration SQL**

```sql
-- 0002_legal_compliance.sql
-- Adds: legal_documents, organizer_consents, participant_consents tables.
-- Adds: consent_config on events, terms/dpa acceptance on organizers.

CREATE TABLE `legal_documents` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `version` integer NOT NULL,
  `title` text NOT NULL,
  `content` text NOT NULL,
  `effective_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `organizer_consents` (
  `id` text PRIMARY KEY NOT NULL,
  `organizer_id` text NOT NULL,
  `document_id` text NOT NULL,
  `accepted_at` integer NOT NULL,
  `ip_address` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`organizer_id`) REFERENCES `organizers`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`document_id`) REFERENCES `legal_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `organizer_consents_organizer_idx` ON `organizer_consents` (`organizer_id`);
--> statement-breakpoint

CREATE TABLE `participant_consents` (
  `id` text PRIMARY KEY NOT NULL,
  `participant_id` text NOT NULL,
  `consent_key` text NOT NULL,
  `consent_label` text NOT NULL,
  `accepted` integer NOT NULL,
  `document_id` text,
  `accepted_at` integer NOT NULL,
  `ip_address` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `participant_consents_participant_idx` ON `participant_consents` (`participant_id`);
--> statement-breakpoint

ALTER TABLE `events` ADD COLUMN `consent_config` text;
--> statement-breakpoint

ALTER TABLE `organizers` ADD COLUMN `terms_accepted_at` integer;
--> statement-breakpoint
ALTER TABLE `organizers` ADD COLUMN `dpa_accepted_at` integer;
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/0002_legal_compliance.sql
git commit -m "feat(db): add legal_documents, organizer_consents, participant_consents tables"
```

---

## Task 4: Database query functions for legal tables

**Files:**
- Create: `src/lib/db/queries/legal.ts`

- [ ] **Step 1: Create legal query functions**

```ts
// src/lib/db/queries/legal.ts
import { and, eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { newId } from "@/lib/ids";

// ── Legal Documents ──

export async function getLatestDocument(
  type: "regulamin" | "privacy_policy" | "organizer_terms" | "dpa" | "cookie_policy",
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.legalDocuments)
    .where(eq(schema.legalDocuments.type, type))
    .orderBy(desc(schema.legalDocuments.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDocumentById(id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.legalDocuments)
    .where(eq(schema.legalDocuments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertLegalDocument(input: {
  type: "regulamin" | "privacy_policy" | "organizer_terms" | "dpa" | "cookie_policy";
  version: number;
  title: string;
  content: string;
  effectiveAt: number;
}) {
  const db = getDb();
  const now = Date.now();
  const id = newId();
  await db.insert(schema.legalDocuments).values({
    id,
    type: input.type,
    version: input.version,
    title: input.title,
    content: input.content,
    effectiveAt: input.effectiveAt,
    createdAt: now,
  });
  return id;
}

// ── Organizer Consents ──

export async function insertOrganizerConsent(input: {
  organizerId: string;
  documentId: string;
  ipAddress: string | null;
}) {
  const db = getDb();
  const now = Date.now();
  await db.insert(schema.organizerConsents).values({
    id: newId(),
    organizerId: input.organizerId,
    documentId: input.documentId,
    acceptedAt: now,
    ipAddress: input.ipAddress,
    createdAt: now,
  });
}

export async function getOrganizerConsents(organizerId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.organizerConsents)
    .where(eq(schema.organizerConsents.organizerId, organizerId))
    .all();
}

// ── Participant Consents ──

export async function insertParticipantConsents(
  participantId: string,
  consents: Array<{
    consentKey: string;
    consentLabel: string;
    accepted: boolean;
    documentId: string | null;
  }>,
  ipAddress: string | null,
) {
  const db = getDb();
  const now = Date.now();
  const rows = consents.map((c) => ({
    id: newId(),
    participantId,
    consentKey: c.consentKey,
    consentLabel: c.consentLabel,
    accepted: c.accepted ? 1 : 0,
    documentId: c.documentId,
    acceptedAt: now,
    ipAddress,
    createdAt: now,
  }));
  if (rows.length > 0) {
    await db.insert(schema.participantConsents).values(rows);
  }
}

export async function getParticipantConsents(participantId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.participantConsents)
    .where(eq(schema.participantConsents.participantId, participantId))
    .all();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/queries/legal.ts
git commit -m "feat(db): add query functions for legal documents and consents"
```

---

## Task 5: Seed legal documents

**Files:**
- Create: `src/lib/legal/seed-documents.ts`

This is a utility that upserts the initial versions of legal documents. It will be run manually or from a script. The actual content is placeholder text -- you said you'll finalize it later.

- [ ] **Step 1: Create seed script**

```ts
// src/lib/legal/seed-documents.ts
import { getLatestDocument, insertLegalDocument } from "@/lib/db/queries/legal";

const INITIAL_DOCUMENTS = [
  {
    type: "regulamin" as const,
    title: "Regulamin serwisu wyjazdo.pl",
    content: `# Regulamin serwisu wyjazdo.pl

## 1. Postanowienia ogólne

1.1. Niniejszy regulamin (dalej: "Regulamin") określa zasady korzystania z serwisu internetowego wyjazdo.pl (dalej: "Serwis"), prowadzonego przez [NAZWA FIRMY], z siedzibą w [ADRES], NIP: [NIP], REGON: [REGON] (dalej: "Usługodawca").

1.2. Serwis umożliwia organizatorom wyjazdów, retreatów i warsztatów (dalej: "Organizatorzy") tworzenie stron wydarzeń z formularzami zapisu oraz obsługę płatności online, a uczestnikom (dalej: "Uczestnicy") zapisywanie się na wydarzenia i dokonywanie płatności.

1.3. Korzystanie z Serwisu wymaga akceptacji niniejszego Regulaminu.

## 2. Definicje

- **Serwis** -- platforma internetowa dostępna pod adresem wyjazdo.pl oraz subdomenami.
- **Organizator** -- osoba fizyczna prowadząca działalność gospodarczą, osoba prawna lub jednostka organizacyjna korzystająca z Serwisu w celu organizacji wydarzeń.
- **Uczestnik** -- osoba fizyczna zapisująca się na wydarzenie za pośrednictwem Serwisu.
- **Wydarzenie** -- wyjazd, retreat, warsztat lub inne wydarzenie organizowane przez Organizatora.

## 3. Zasady korzystania z Serwisu

3.1. Serwis świadczy usługi drogą elektroniczną w rozumieniu ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.

3.2. Wymagania techniczne: przeglądarka internetowa z obsługą JavaScript, dostęp do internetu.

3.3. Zabrania się dostarczania treści o charakterze bezprawnym.

## 4. Umowa między Organizatorem a Uczestnikiem

4.1. Serwis pełni rolę pośrednika technicznego. Umowa dotycząca udziału w wydarzeniu zawierana jest bezpośrednio między Organizatorem a Uczestnikiem.

4.2. Usługodawca nie jest stroną umowy o udział w wydarzeniu i nie ponosi odpowiedzialności za wykonanie zobowiązań Organizatora wobec Uczestnika.

## 5. Płatności

5.1. Płatności realizowane są za pośrednictwem operatora Stripe. Uczestnik dokonuje płatności na rachunek Organizatora prowadzony przez Stripe.

5.2. Usługodawca nie przechowuje danych kart płatniczych.

## 6. Prawo odstąpienia

6.1. Zgodnie z art. 38 pkt 12 ustawy z dnia 30 maja 2014 r. o prawach konsumenta, prawo odstąpienia od umowy nie przysługuje w odniesieniu do umów o świadczenie usług związanych z wydarzeniami rozrywkowymi, sportowymi lub kulturalnymi, jeżeli w umowie oznaczono dzień lub okres świadczenia usługi.

6.2. Zasady rezygnacji z udziału w wydarzeniu określa Organizator w regulaminie wydarzenia.

## 7. Reklamacje

7.1. Reklamacje dotyczące działania Serwisu należy składać na adres: [EMAIL].

7.2. Usługodawca rozpatruje reklamacje w terminie 14 dni od ich otrzymania.

## 8. Postanowienia końcowe

8.1. Usługodawca zastrzega sobie prawo do zmiany Regulaminu. O zmianach użytkownicy zostaną poinformowani z 14-dniowym wyprzedzeniem.

8.2. W sprawach nieuregulowanych niniejszym Regulaminem zastosowanie mają przepisy prawa polskiego.

8.3. Link do platformy ODR: https://ec.europa.eu/consumers/odr/

Data wejścia w życie: [DATA]`,
  },
  {
    type: "privacy_policy" as const,
    title: "Polityka prywatności wyjazdo.pl",
    content: `# Polityka prywatności wyjazdo.pl

## 1. Administrator danych

Administratorem Twoich danych osobowych jest [NAZWA FIRMY], z siedzibą w [ADRES], NIP: [NIP] (dalej: "Administrator").

Kontakt: [EMAIL]

## 2. Cele i podstawy przetwarzania

Przetwarzamy Twoje dane w następujących celach:

| Cel | Podstawa prawna | Okres przechowywania |
|-----|----------------|---------------------|
| Świadczenie usług Serwisu (konto, zapisy na wydarzenia) | Art. 6 ust. 1 lit. b RODO -- wykonanie umowy | Czas trwania umowy + 3 lata |
| Obsługa płatności | Art. 6 ust. 1 lit. b RODO -- wykonanie umowy | Czas trwania umowy + okres przedawnienia |
| Rozliczenia podatkowe | Art. 6 ust. 1 lit. c RODO -- obowiązek prawny | 5 lat od końca roku podatkowego |
| Dochodzenie roszczeń | Art. 6 ust. 1 lit. f RODO -- uzasadniony interes | Do przedawnienia roszczeń |
| Marketing bezpośredni (za zgodą) | Art. 6 ust. 1 lit. a RODO -- zgoda | Do wycofania zgody |

## 3. Odbiorcy danych

Twoje dane mogą być przekazywane:
- Stripe (obsługa płatności)
- Cloudflare (hosting)
- Resend (wysyłka e-mail)
- Clerk (autentykacja organizatorów)
- Organizatorom wydarzeń, na które się zapisujesz

## 4. Transfer danych poza EOG

Niektórzy z naszych podwykonawców (Stripe, Cloudflare, Clerk) mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym, na podstawie standardowych klauzul umownych (SCC) lub decyzji o adekwatności.

## 5. Twoje prawa

Przysługuje Ci prawo do:
- dostępu do danych (art. 15 RODO)
- sprostowania danych (art. 16 RODO)
- usunięcia danych (art. 17 RODO)
- ograniczenia przetwarzania (art. 18 RODO)
- przenoszenia danych (art. 20 RODO)
- sprzeciwu (art. 21 RODO)
- wycofania zgody w dowolnym momencie (art. 7 ust. 3 RODO)
- wniesienia skargi do Prezesa UODO (ul. Stawki 2, 00-193 Warszawa)

## 6. Informacja o wymogu podania danych

Podanie danych jest dobrowolne, ale niezbędne do korzystania z Serwisu. Bez podania danych oznaczonych jako wymagane nie jest możliwe zapisanie się na wydarzenie.

## 7. Profilowanie

Serwis nie podejmuje zautomatyzowanych decyzji, w tym profilowania, o którym mowa w art. 22 ust. 1 i 4 RODO.

Data wejścia w życie: [DATA]`,
  },
  {
    type: "dpa" as const,
    title: "Umowa powierzenia przetwarzania danych osobowych",
    content: `# Umowa powierzenia przetwarzania danych osobowych

zawarta pomiędzy:

**Administratorem** -- Organizatorem korzystającym z Serwisu wyjazdo.pl (dalej: "Administrator")

a

**Podmiotem przetwarzającym** -- [NAZWA FIRMY], z siedzibą w [ADRES], NIP: [NIP] (dalej: "Procesor"), operatorem Serwisu wyjazdo.pl.

## 1. Przedmiot umowy

1.1. Administrator powierza Procesorowi przetwarzanie danych osobowych uczestników wydarzeń organizowanych za pośrednictwem Serwisu, na zasadach określonych w art. 28 RODO.

## 2. Zakres powierzenia

- **Kategorie osób:** uczestnicy wydarzeń Administratora
- **Rodzaje danych:** imię, nazwisko, adres e-mail, numer telefonu, odpowiedzi na pytania niestandardowe, dane o płatnościach
- **Charakter przetwarzania:** zbieranie, przechowywanie, udostępnianie Administratorowi
- **Cel przetwarzania:** umożliwienie rejestracji na wydarzenia i obsługi płatności
- **Czas trwania:** okres korzystania z Serwisu przez Administratora

## 3. Obowiązki Procesora

Procesor zobowiązuje się do:
- przetwarzania danych wyłącznie na udokumentowane polecenie Administratora
- zapewnienia, że osoby upoważnione do przetwarzania zobowiązały się do zachowania poufności
- wdrożenia odpowiednich środków technicznych i organizacyjnych (szyfrowanie, kontrola dostępu)
- przestrzegania warunków korzystania z usług innego podmiotu przetwarzającego (podprocesorów)
- pomagania Administratorowi w realizacji praw osób, których dane dotyczą
- pomagania Administratorowi w zapewnieniu bezpieczeństwa przetwarzania
- usunięcia lub zwrotu danych po zakończeniu współpracy, na żądanie Administratora
- udostępniania Administratorowi informacji niezbędnych do wykazania zgodności z art. 28 RODO

## 4. Podprocesorzy

4.1. Administrator wyraża ogólną zgodę na korzystanie z podprocesorów. Aktualna lista podprocesorów: Cloudflare (hosting), Stripe (płatności), Resend (e-mail).

4.2. Procesor poinformuje Administratora o zamiarze dodania lub zmiany podprocesora z 14-dniowym wyprzedzeniem.

## 5. Postanowienia końcowe

5.1. Umowa wchodzi w życie z chwilą akceptacji przez Administratora (Organizatora) podczas rejestracji w Serwisie.

5.2. W sprawach nieuregulowanych zastosowanie mają przepisy RODO i prawa polskiego.

Data wejścia w życie: [DATA]`,
  },
] as const;

export async function seedLegalDocuments() {
  const results: Array<{ type: string; action: string; id?: string }> = [];

  for (const doc of INITIAL_DOCUMENTS) {
    const existing = await getLatestDocument(doc.type);
    if (existing) {
      results.push({ type: doc.type, action: "skipped (already exists)" });
      continue;
    }
    const id = await insertLegalDocument({
      type: doc.type,
      version: 1,
      title: doc.title,
      content: doc.content,
      effectiveAt: Date.now(),
    });
    results.push({ type: doc.type, action: "inserted", id });
  }

  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/legal/seed-documents.ts
git commit -m "feat(legal): add seed script for initial legal documents"
```

---

## Task 6: Organizer onboarding consent checkboxes

**Files:**
- Modify: `src/lib/validators/organizer.ts`
- Modify: `src/app/dashboard/onboarding/page.tsx`
- Modify: `src/app/dashboard/onboarding/actions.ts`

- [ ] **Step 1: Extend organizer onboarding schema**

In `src/lib/validators/organizer.ts`, add to the `organizerProfileSchema` object:

```ts
export const organizerProfileSchema = z.object({
  subdomain: subdomainSchema.refine((s) => !RESERVED_SUBDOMAINS.has(s), "Ta nazwa jest zarezerwowana"),
  displayName: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Akceptacja regulaminu jest wymagana." }),
  }),
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: "Zapoznanie się z polityką prywatności jest wymagane." }),
  }),
  acceptDpa: z.literal(true, {
    errorMap: () => ({ message: "Akceptacja umowy powierzenia danych jest wymagana." }),
  }),
});
```

- [ ] **Step 2: Update the onboarding form UI**

Replace the full content of `src/app/dashboard/onboarding/page.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { createOrganizerAction } from "./actions";
import { Card, Checkbox, Input, SubmitButton, Textarea } from "@/components/ui";

export default function OnboardingPage() {
  const [subdomain, setSubdomain] = useState("");
  const [state, formAction] = useActionState<{ error?: string; errors?: Record<string, string> } | null, FormData>(
    async (_prev, formData) => {
      return (await createOrganizerAction(formData)) ?? null;
    },
    null,
  );

  const previewSlug = subdomain.trim() ? subdomain.trim().toLowerCase() : "twoja-nazwa";

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Witaj w Wyjazdo</h1>
      <p className="mt-2 text-muted-foreground">Stwórz swój profil organizatora, aby zacząć.</p>

      <Card className="mt-8">
        <form action={formAction} className="space-y-4">
          <div>
            <Input
              name="subdomain"
              label="Nazwa w URL (subdomena)"
              required
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              minLength={3}
              maxLength={32}
              placeholder="np. gorskie-wyjazdy"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Podgląd adresu:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground">
                {previewSlug}.wyjazdo.pl
              </code>
            </p>
          </div>
          <Input name="displayName" label="Wyświetlana nazwa" required maxLength={100} />
          <Textarea name="description" label="Krótki opis" maxLength={2000} rows={4} />

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Dokumenty i zgody</p>
            <Checkbox
              name="acceptTerms"
              value="true"
              label={
                <>
                  Akceptuję{" "}
                  <a href="/regulamin" target="_blank" className="underline underline-offset-4 hover:text-primary">
                    Regulamin serwisu wyjazdo.pl
                  </a>{" "}
                  *
                </>
              }
              error={state?.errors?.acceptTerms}
            />
            <Checkbox
              name="acceptPrivacy"
              value="true"
              label={
                <>
                  Zapoznałem/am się z{" "}
                  <a href="/polityka-prywatnosci" target="_blank" className="underline underline-offset-4 hover:text-primary">
                    Polityką Prywatności
                  </a>{" "}
                  *
                </>
              }
              error={state?.errors?.acceptPrivacy}
            />
            <Checkbox
              name="acceptDpa"
              value="true"
              label={
                <>
                  Akceptuję{" "}
                  <a href="/regulamin#umowa-powierzenia" target="_blank" className="underline underline-offset-4 hover:text-primary">
                    Umowę powierzenia przetwarzania danych osobowych
                  </a>{" "}
                  (art. 28 RODO) *
                </>
              }
              error={state?.errors?.acceptDpa}
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <SubmitButton pendingLabel="Tworzenie...">Utwórz profil</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Update the onboarding action to validate and record consents**

Replace the full content of `src/app/dashboard/onboarding/actions.ts`:

```ts
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
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

export async function createOrganizerAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existing = await getOrganizerByClerkUserId(userId);
  if (existing) redirect("/dashboard");

  const parsed = organizerProfileSchema.safeParse({
    subdomain: String(formData.get("subdomain") ?? "").toLowerCase(),
    displayName: String(formData.get("displayName") ?? ""),
    description: (formData.get("description") as string) || undefined,
    acceptTerms: formData.get("acceptTerms") === "true" ? true : false,
    acceptPrivacy: formData.get("acceptPrivacy") === "true" ? true : false,
    acceptDpa: formData.get("acceptDpa") === "true" ? true : false,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }

  if (await isSubdomainTaken(parsed.data.subdomain)) {
    return { error: "Ta nazwa jest już zajęta" };
  }

  const user = await currentUser();
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

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
    contactEmail: primaryEmail,
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

- [ ] **Step 4: Update `createOrganizer` to accept the new fields**

In `src/lib/db/queries/organizers.ts`, update the `createOrganizer` function's input type:

```ts
export async function createOrganizer(input: {
  id: string;
  clerkUserId: string;
  subdomain: string;
  displayName: string;
  description?: string | null;
  contactEmail?: string | null;
  termsAcceptedAt?: number | null;
  dpaAcceptedAt?: number | null;
}) {
  const db = getDb();
  const now = Date.now();
  await db.insert(schema.organizers).values({
    id: input.id,
    clerkUserId: input.clerkUserId,
    subdomain: input.subdomain,
    displayName: input.displayName,
    description: input.description ?? null,
    contactEmail: input.contactEmail ?? null,
    termsAcceptedAt: input.termsAcceptedAt ?? null,
    dpaAcceptedAt: input.dpaAcceptedAt ?? null,
    createdAt: now,
    updatedAt: now,
  });
}
```

- [ ] **Step 5: Verify build**

Run: `cd /home/stas/Desktop/wyjazdo && npx next build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/lib/validators/organizer.ts src/app/dashboard/onboarding/page.tsx src/app/dashboard/onboarding/actions.ts src/lib/db/queries/organizers.ts
git commit -m "feat(onboarding): require regulamin, privacy policy, and DPA acceptance"
```

---

## Task 7: Event consent configuration (dashboard editor)

**Files:**
- Modify: `src/lib/validators/event.ts`
- Create: `src/components/dashboard/EventConsentsEditor.tsx`
- Modify: `src/app/dashboard/events/[id]/EventEditForm.tsx`
- Modify: `src/app/dashboard/events/[id]/actions.ts`

- [ ] **Step 1: Add consentConfig to event validator**

In `src/lib/validators/event.ts`, add the import and schema:

```ts
import { z } from "zod";
import { consentConfigSchema } from "./consent";
```

Then add `consentConfig` to the `eventBaseSchema` object (before the `.refine()` chain), after `balanceDueAt`:

```ts
    consentConfig: consentConfigSchema,
```

- [ ] **Step 2: Create the EventConsentsEditor component**

```tsx
// src/components/dashboard/EventConsentsEditor.tsx
"use client";

import { useState } from "react";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import { newId } from "@/lib/ids";

type Props = {
  initial: ConsentConfigItem[];
  name: string;
};

const PRESET_CONSENTS: Array<{
  label: string;
  description: string;
  category: ConsentConfigItem["category"];
}> = [
  {
    label: "Zgoda na wykorzystanie wizerunku",
    description:
      "Wyrażam zgodę na utrwalanie i wykorzystanie mojego wizerunku (zdjęcia, filmy) w celach promocyjnych organizatora, zgodnie z art. 81 ustawy o prawie autorskim.",
    category: "photo",
  },
  {
    label: "Zgoda na przetwarzanie danych dot. zdrowia",
    description:
      "Wyrażam zgodę na przetwarzanie podanych przeze mnie danych dotyczących zdrowia w celu zapewnienia bezpieczeństwa podczas wydarzenia (art. 9 ust. 2 lit. a RODO).",
    category: "health",
  },
  {
    label: "Zgoda na komunikację marketingową organizatora",
    description:
      "Wyrażam zgodę na otrzymywanie informacji marketingowych od organizatora drogą elektroniczną.",
    category: "marketing",
  },
];

export default function EventConsentsEditor({ initial, name }: Props) {
  const [consents, setConsents] = useState<ConsentConfigItem[]>(initial);

  function update(i: number, patch: Partial<ConsentConfigItem>) {
    setConsents((c) => c.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function remove(i: number) {
    setConsents((c) => c.filter((_, idx) => idx !== i));
  }
  function addPreset(preset: (typeof PRESET_CONSENTS)[number]) {
    setConsents((c) => [
      ...c,
      {
        id: newId(),
        label: preset.label,
        description: preset.description,
        required: false,
        category: preset.category,
      },
    ]);
  }
  function addCustom() {
    setConsents((c) => [
      ...c,
      { id: newId(), label: "", description: "", required: false, category: "custom" as const },
    ]);
  }

  const usedCategories = new Set(consents.map((c) => c.category));

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(consents)} />

      {/* Read-only: platform consents */}
      <div className="mb-4 rounded-md border border-border/80 bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Zgody wymagane przez platformę (zawsze widoczne, nie można usunąć)
        </p>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          <li className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded border border-primary bg-primary/10" />
            Akceptacja Regulaminu serwisu wyjazdo.pl
            <span className="ml-auto text-xs text-muted-foreground">wymagane</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded border border-primary bg-primary/10" />
            Zapoznanie się z Polityką Prywatności
            <span className="ml-auto text-xs text-muted-foreground">wymagane</span>
          </li>
        </ul>
      </div>

      {/* Organizer-configured consents */}
      {consents.length > 0 && (
        <ul className="space-y-3">
          {consents.map((c, i) => (
            <li key={c.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap gap-2">
                <input
                  placeholder="Treść zgody"
                  value={c.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  className="min-w-[12rem] flex-1 rounded border px-2 py-1 text-sm"
                />
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={c.required}
                    onChange={(e) => update(i, { required: e.target.checked })}
                  />
                  wymagana
                </label>
                <button type="button" onClick={() => remove(i)} className="text-sm text-red-600">
                  Usuń
                </button>
              </div>
              {(c.category === "custom" || c.description) && (
                <textarea
                  placeholder="Opis / pełna treść zgody (opcjonalnie)"
                  value={c.description ?? ""}
                  onChange={(e) => update(i, { description: e.target.value })}
                  className="mt-2 w-full rounded border px-2 py-1 text-sm"
                  rows={2}
                />
              )}
              {c.category !== "custom" && (
                <span className="mt-2 inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {c.category === "photo" && "wizerunek"}
                  {c.category === "health" && "dane zdrowotne"}
                  {c.category === "marketing" && "marketing"}
                  {c.category === "general" && "ogólna"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESET_CONSENTS.filter((p) => !usedCategories.has(p.category)).map((preset) => (
          <button
            key={preset.category}
            type="button"
            onClick={() => addPreset(preset)}
            className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
          >
            + {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={addCustom}
          className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          + Własna zgoda
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add consents section to EventEditForm**

In `src/app/dashboard/events/[id]/EventEditForm.tsx`:

Add import at top:

```tsx
import type { ConsentConfigItem } from "@/lib/validators/consent";
import EventConsentsEditor from "@/components/dashboard/EventConsentsEditor";
```

Add `initialConsents` to Props type:

```tsx
type Props = {
  eventId: string;
  showCreationStep2?: boolean;
  event: {
    title: string;
    description: string | null;
    location: string | null;
    startsAt: number;
    endsAt: number;
    priceCents: number;
    capacity: number;
    coverUrl: string | null;
    depositCents: number | null;
    balanceDueAt: number | null;
  };
  initialQuestions: CustomQuestion[];
  initialConsents: ConsentConfigItem[];
};
```

Update the destructuring:

```tsx
export function EventEditForm({
  eventId,
  event,
  initialQuestions,
  initialConsents,
  showCreationStep2 = false,
}: Props) {
```

Add a new `<Section>` after the "Pytania do uczestnika" section (before the submit button `<div>`):

```tsx
      <Section
        title="Zgody i regulaminy"
        description="Zgody platformy są obowiązkowe i wyświetlane automatycznie. Możesz dodać własne zgody, np. na wykorzystanie wizerunku, przetwarzanie danych o zdrowiu lub akceptację regulaminu wydarzenia."
      >
        {state?.errors?.consentConfig && (
          <p className="text-sm text-destructive" role="alert">
            {state.errors.consentConfig}
          </p>
        )}
        <EventConsentsEditor initial={initialConsents} name="consentConfig" />
      </Section>
```

- [ ] **Step 4: Update saveEventAction to handle consentConfig**

In `src/app/dashboard/events/[id]/actions.ts`, add import:

```ts
import { consentConfigSchema } from "@/lib/validators/consent";
```

Inside `saveEventAction`, after the `questionsParsed` block (around line 33), add a similar block for consents:

```ts
  let consentsParsed;
  try {
    const consentsRaw = String(formData.get("consentConfig") ?? "[]");
    consentsParsed = consentConfigSchema.safeParse(JSON.parse(consentsRaw));
  } catch {
    return { errors: { consentConfig: "Nieprawidłowy format listy zgód." } };
  }
  if (!consentsParsed.success) {
    return {
      errors: {
        consentConfig:
          consentsParsed.error.issues[0]?.message ?? "Błąd walidacji zgód.",
      },
    };
  }
```

In the `raw` object, add:

```ts
    consentConfig: consentsParsed.data,
```

In the `updateEvent` call, add:

```ts
    consentConfig: JSON.stringify(parsed.data.consentConfig),
```

- [ ] **Step 5: Update the event edit page to pass initialConsents**

In `src/app/dashboard/events/[id]/page.tsx`, where `EventEditForm` is rendered, load and pass the consent config. Find where `initialQuestions` is computed from the event and add similar logic:

```tsx
const initialConsents: ConsentConfigItem[] = existing.consentConfig
  ? JSON.parse(existing.consentConfig)
  : [];
```

And pass it:

```tsx
<EventEditForm
  eventId={existing.id}
  event={...}
  initialQuestions={initialQuestions}
  initialConsents={initialConsents}
  showCreationStep2={...}
/>
```

(Add the import for `ConsentConfigItem` from `@/lib/validators/consent`.)

- [ ] **Step 6: Verify build**

Run: `cd /home/stas/Desktop/wyjazdo && npx next build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/lib/validators/event.ts src/lib/validators/consent.ts src/components/dashboard/EventConsentsEditor.tsx src/app/dashboard/events/[id]/EventEditForm.tsx src/app/dashboard/events/[id]/actions.ts src/app/dashboard/events/[id]/page.tsx
git commit -m "feat(events): add consent configuration section to event editor"
```

---

## Task 8: Participant registration consent checkboxes

**Files:**
- Create: `src/components/sites/ConsentCheckboxes.tsx`
- Modify: `src/app/sites/[subdomain]/[eventSlug]/register/RegisterForm.tsx`
- Modify: `src/app/sites/[subdomain]/[eventSlug]/register/page.tsx`
- Modify: `src/lib/validators/registration.ts`

- [ ] **Step 1: Create ConsentCheckboxes component**

```tsx
// src/components/sites/ConsentCheckboxes.tsx
"use client";

import type { ConsentConfigItem } from "@/lib/validators/consent";
import { Checkbox } from "@/components/ui";

type Props = {
  eventConsents: ConsentConfigItem[];
  errors?: Record<string, string>;
};

export function ConsentCheckboxes({ eventConsents, errors }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Zgody i oświadczenia</p>

      {/* Platform-required consents */}
      <Checkbox
        name="consent_regulamin"
        value="true"
        label={
          <>
            Akceptuję{" "}
            <a
              href="/regulamin"
              target="_blank"
              className="underline underline-offset-4 hover:text-primary"
            >
              Regulamin serwisu wyjazdo.pl
            </a>{" "}
            *
          </>
        }
        error={errors?.consent_regulamin}
      />
      <Checkbox
        name="consent_privacy"
        value="true"
        label={
          <>
            Zapoznałem/am się z{" "}
            <a
              href="/polityka-prywatnosci"
              target="_blank"
              className="underline underline-offset-4 hover:text-primary"
            >
              Polityką Prywatności
            </a>{" "}
            *
          </>
        }
        error={errors?.consent_privacy}
      />

      {/* Event-specific consents from organizer */}
      {eventConsents.map((consent) => (
        <div key={consent.id}>
          <Checkbox
            name={`consent_${consent.id}`}
            value="true"
            label={
              <>
                {consent.label}
                {consent.required ? " *" : ""}
              </>
            }
            error={errors?.[`consent_${consent.id}`]}
          />
          {consent.description && (
            <p className="ml-7 mt-1 text-xs text-muted-foreground">
              {consent.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update RegisterForm to accept and render consents**

In `src/app/sites/[subdomain]/[eventSlug]/register/RegisterForm.tsx`:

Add import:

```tsx
import type { ConsentConfigItem } from "@/lib/validators/consent";
import { ConsentCheckboxes } from "@/components/sites/ConsentCheckboxes";
```

Add `consents` to Props:

```tsx
type Props = {
  eventId: string;
  subdomain: string;
  eventSlug: string;
  isFull: boolean;
  questions: CustomQuestion[];
  consents: ConsentConfigItem[];
};
```

Update destructuring:

```tsx
export function RegisterForm({ eventId, subdomain, eventSlug, isFull, questions, consents }: Props) {
```

Add the consent checkboxes after the questions loop (before the `_form` error block):

```tsx
        <ConsentCheckboxes eventConsents={consents} errors={state?.errors} />
```

- [ ] **Step 3: Update the register page to load and pass consents**

In `src/app/sites/[subdomain]/[eventSlug]/register/page.tsx`:

Add import:

```tsx
import type { ConsentConfigItem } from "@/lib/validators/consent";
```

After the `questions` parsing, add:

```tsx
  const consents: ConsentConfigItem[] = event.consentConfig
    ? JSON.parse(event.consentConfig)
    : [];
```

Pass to RegisterForm:

```tsx
      <RegisterForm
        eventId={event.id}
        subdomain={subdomain}
        eventSlug={eventSlug}
        isFull={isFull}
        questions={questions}
        consents={consents}
      />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/sites/ConsentCheckboxes.tsx src/app/sites/[subdomain]/[eventSlug]/register/RegisterForm.tsx src/app/sites/[subdomain]/[eventSlug]/register/page.tsx
git commit -m "feat(register): render consent checkboxes on participant registration form"
```

---

## Task 9: Validate and record participant consents on registration

**Files:**
- Modify: `src/lib/validators/registration.ts`
- Modify: `src/lib/register/process-registration.ts`

- [ ] **Step 1: Keep registrationBaseSchema unchanged**

The registration schema stays as-is -- consent validation happens separately because it depends on the event's consent config (dynamic, not statically typed).

- [ ] **Step 2: Update process-registration.ts to validate and record consents**

In `src/lib/register/process-registration.ts`:

Add imports:

```ts
import type { ConsentConfigItem } from "@/lib/validators/consent";
import {
  getLatestDocument,
  insertParticipantConsents,
} from "@/lib/db/queries/legal";
```

After the custom questions validation block (after `if (Object.keys(errors).length > 0) return { errors };` around line 76), add consent validation:

```ts
  // ── Consent validation ──
  const consents: ConsentConfigItem[] = event.consentConfig
    ? JSON.parse(event.consentConfig)
    : [];

  // Platform-required consents
  if (form.get("consent_regulamin") !== "true") {
    errors.consent_regulamin = "Akceptacja regulaminu jest wymagana.";
  }
  if (form.get("consent_privacy") !== "true") {
    errors.consent_privacy = "Zapoznanie się z polityką prywatności jest wymagane.";
  }

  // Event-specific required consents
  for (const consent of consents) {
    if (consent.required && form.get(`consent_${consent.id}`) !== "true") {
      errors[`consent_${consent.id}`] = "Ta zgoda jest wymagana.";
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
```

After inserting the participant (both the waitlist and normal paths), record the consents. Add a helper function at module level:

```ts
async function recordParticipantConsents(
  participantId: string,
  form: FormData,
  eventConsents: ConsentConfigItem[],
  ip: string | null,
) {
  const [regulamin, privacyPolicy] = await Promise.all([
    getLatestDocument("regulamin"),
    getLatestDocument("privacy_policy"),
  ]);

  const consentRows: Array<{
    consentKey: string;
    consentLabel: string;
    accepted: boolean;
    documentId: string | null;
  }> = [
    {
      consentKey: "platform_regulamin",
      consentLabel: "Akceptacja Regulaminu serwisu wyjazdo.pl",
      accepted: form.get("consent_regulamin") === "true",
      documentId: regulamin?.id ?? null,
    },
    {
      consentKey: "platform_privacy",
      consentLabel: "Zapoznanie się z Polityką Prywatności",
      accepted: form.get("consent_privacy") === "true",
      documentId: privacyPolicy?.id ?? null,
    },
  ];

  for (const consent of eventConsents) {
    consentRows.push({
      consentKey: `event_${consent.id}`,
      consentLabel: consent.label,
      accepted: form.get(`consent_${consent.id}`) === "true",
      documentId: null,
    });
  }

  await insertParticipantConsents(participantId, consentRows, ip);
}
```

In the **waitlist path** (after `insertParticipant` for waitlisted), add before the email block:

```ts
    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    // Record consents (best-effort)
    recordParticipantConsents(participantId, form, consents, ip).catch(() => {});
```

In the **normal registration path** (after `insertParticipant` for active), add before the payment block:

```ts
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  // Record consents (best-effort)
  recordParticipantConsents(participantId, form, consents, ip).catch(() => {});
```

Note: `headers` is already imported at the top of the file.

- [ ] **Step 3: Verify build**

Run: `cd /home/stas/Desktop/wyjazdo && npx next build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/register/process-registration.ts
git commit -m "feat(register): validate and record participant consent acceptance"
```

---

## Task 10: Public legal document pages

**Files:**
- Create: `src/app/(legal)/layout.tsx`
- Create: `src/app/(legal)/regulamin/page.tsx`
- Create: `src/app/(legal)/polityka-prywatnosci/page.tsx`

- [ ] **Step 1: Create legal pages layout**

```tsx
// src/app/(legal)/layout.tsx
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {children}
    </main>
  );
}
```

- [ ] **Step 2: Create Terms of Service page**

```tsx
// src/app/(legal)/regulamin/page.tsx
import type { Metadata } from "next";
import { getLatestDocument } from "@/lib/db/queries/legal";

export const metadata: Metadata = {
  title: "Regulamin — wyjazdo.pl",
};

export default async function RegulaminPage() {
  const doc = await getLatestDocument("regulamin");

  if (!doc) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Regulamin serwisu wyjazdo.pl</h1>
        <p className="mt-4 text-muted-foreground">Dokument jest w przygotowaniu.</p>
      </div>
    );
  }

  return (
    <article className="prose prose-neutral max-w-none">
      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(doc.content) }} />
      <p className="mt-8 text-sm text-muted-foreground">
        Wersja {doc.version} — obowiązuje od{" "}
        {new Date(doc.effectiveAt).toLocaleDateString("pl-PL")}
      </p>
    </article>
  );
}

/** Minimal markdown-to-HTML for legal docs (headings, paragraphs, lists, tables, bold, links). */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hulo])/gm, (line) => (line.trim() ? `<p>${line}` : ""))
    .replace(/<p><(h[1-3]|ul|li|ol)/g, "<$1");
}
```

- [ ] **Step 3: Create Privacy Policy page**

```tsx
// src/app/(legal)/polityka-prywatnosci/page.tsx
import type { Metadata } from "next";
import { getLatestDocument } from "@/lib/db/queries/legal";

export const metadata: Metadata = {
  title: "Polityka Prywatności — wyjazdo.pl",
};

export default async function PolitykaPrywatnosciPage() {
  const doc = await getLatestDocument("privacy_policy");

  if (!doc) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Polityka Prywatności wyjazdo.pl</h1>
        <p className="mt-4 text-muted-foreground">Dokument jest w przygotowaniu.</p>
      </div>
    );
  }

  return (
    <article className="prose prose-neutral max-w-none">
      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(doc.content) }} />
      <p className="mt-8 text-sm text-muted-foreground">
        Wersja {doc.version} — obowiązuje od{" "}
        {new Date(doc.effectiveAt).toLocaleDateString("pl-PL")}
      </p>
    </article>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hulo])/gm, (line) => (line.trim() ? `<p>${line}` : ""))
    .replace(/<p><(h[1-3]|ul|li|ol)/g, "<$1");
}
```

- [ ] **Step 4: Verify build**

Run: `cd /home/stas/Desktop/wyjazdo && npx next build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/\(legal\)/layout.tsx src/app/\(legal\)/regulamin/page.tsx src/app/\(legal\)/polityka-prywatnosci/page.tsx
git commit -m "feat(legal): add public regulamin and privacy policy pages"
```

---

## Task 11: Show participant consents in dashboard (organizer view)

**Files:**
- Modify: The participant detail section in the dashboard event page

This task adds a read-only consents section when an organizer views a participant's details, so they can see what each participant agreed to.

- [ ] **Step 1: Find the participant detail view in the dashboard**

Look at the event dashboard page (`src/app/dashboard/events/[id]/page.tsx`) -- it shows a participant table. Find where individual participant details are rendered and add a consents section.

The exact implementation depends on how the participant detail is currently shown. Query `getParticipantConsents(participantId)` from `src/lib/db/queries/legal.ts` and render as a simple list:

```tsx
// Example rendering (adapt to actual component structure):
{participantConsents.length > 0 && (
  <div className="mt-4">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Zgody
    </p>
    <ul className="mt-2 space-y-1 text-sm">
      {participantConsents.map((c) => (
        <li key={c.id} className="flex items-center gap-2">
          {c.accepted ? (
            <span className="text-green-600">✓</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <span>{c.consentLabel}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(c.acceptedAt).toLocaleDateString("pl-PL")}
          </span>
        </li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/events/[id]/
git commit -m "feat(dashboard): show participant consent details in event view"
```

---

## Task 12: Run migration and seed on dev environment

- [ ] **Step 1: Apply the migration**

Run: `cd /home/stas/Desktop/wyjazdo && npx wrangler d1 migrations apply DB --local`
Expected: Migration 0002_legal_compliance.sql applied successfully

- [ ] **Step 2: Seed legal documents**

Create a temporary API route or script to call `seedLegalDocuments()`, or use wrangler D1 execute to insert directly. The simplest approach is a one-time API route:

```ts
// src/app/api/seed-legal/route.ts (temporary -- delete after seeding)
import { seedLegalDocuments } from "@/lib/legal/seed-documents";
import { NextResponse } from "next/server";

export async function GET() {
  const results = await seedLegalDocuments();
  return NextResponse.json(results);
}
```

Run: `curl http://localhost:3000/api/seed-legal`
Expected: JSON array showing inserted documents

- [ ] **Step 3: Delete the temporary seed route**

Remove `src/app/api/seed-legal/route.ts`.

- [ ] **Step 4: Test the full flow**

1. Visit `/regulamin` -- should show the Terms of Service
2. Visit `/polityka-prywatnosci` -- should show Privacy Policy
3. Go through organizer onboarding -- consent checkboxes should appear and be required
4. Create/edit an event -- "Zgody i regulaminy" section should appear
5. Add a photo consent to an event, publish it
6. Register as a participant -- all consent checkboxes should appear
7. Check the dashboard participant view -- consents should be listed

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat(legal): complete legal compliance integration"
```

---

## Summary of data flow

```
Organizer onboarding:
  form checkboxes → server action validates → organizers.terms_accepted_at/dpa_accepted_at set
                                            → organizer_consents rows inserted (audit trail)

Event configuration:
  EventConsentsEditor → JSON → events.consent_config column

Participant registration:
  ConsentCheckboxes rendered (platform + event consents)
    → form submitted → process-registration validates required consents
    → participant_consents rows inserted (audit trail with document version, IP, timestamp)

Legal pages:
  /regulamin, /polityka-prywatnosci → read latest version from legal_documents table
```

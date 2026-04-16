# Event Photo Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow organizers to upload up to 5 gallery photos per event, displayed as a thumbnail row with lightbox on the public event page.

**Architecture:** New `eventPhotos` table with `id`, `eventId`, `url`, `position`, `createdAt`. A client-side `GalleryUpload` component handles multi-image upload via the existing `/api/images/upload` R2 endpoint. Server actions sync gallery state on form submit. Public page renders a thumbnail row that opens a `Lightbox` component on click.

**Tech Stack:** Drizzle ORM (SQLite/D1), Next.js Server Actions with `useActionState`, React client components, Tailwind CSS, Cloudflare R2 for storage.

---

## File Structure

**Create:**
- `src/lib/db/migrations/0003_event_photos.sql` — migration for `event_photos` table
- `src/lib/db/queries/event-photos.ts` — DB query functions for event photos
- `src/components/dashboard/GalleryUpload.tsx` — multi-image upload/manage component for organizer forms
- `src/components/sites/PhotoGallery.tsx` — thumbnail row + lightbox for public event page

**Modify:**
- `src/lib/db/schema.ts` — add `eventPhotos` table definition + exported types
- `src/app/dashboard/events/[id]/EventEditForm.tsx` — add gallery section
- `src/app/dashboard/events/[id]/actions.ts` — sync gallery photos on save
- `src/app/dashboard/events/[id]/page.tsx` — load and pass gallery photos to edit form
- `src/app/dashboard/events/new/page.tsx` — add gallery section to creation form
- `src/app/dashboard/events/new/actions.ts` — insert gallery photos on create
- `src/app/sites/[subdomain]/[eventSlug]/page.tsx` — render gallery on public page

---

### Task 1: Database Schema & Migration

**Files:**
- Modify: `src/lib/db/schema.ts:56-59` (after events table, before participants)
- Create: `src/lib/db/migrations/0003_event_photos.sql`

- [ ] **Step 1: Add `eventPhotos` table to Drizzle schema**

In `src/lib/db/schema.ts`, add the following after the `events` table definition (after line 60, before the `participants` table):

```typescript
export const eventPhotos = sqliteTable(
  "event_photos",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    eventIdx: index("event_photos_event_idx").on(t.eventId),
  }),
);
```

Also add the type exports at the bottom of the file alongside the existing ones:

```typescript
export type EventPhoto = typeof eventPhotos.$inferSelect;
export type NewEventPhoto = typeof eventPhotos.$inferInsert;
```

- [ ] **Step 2: Create the SQL migration file**

Create `src/lib/db/migrations/0003_event_photos.sql`:

```sql
-- 0003_event_photos.sql
-- Adds: event_photos table for gallery images.

CREATE TABLE `event_photos` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `url` text NOT NULL,
  `position` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_photos_event_idx` ON `event_photos` (`event_id`);
```

- [ ] **Step 3: Run the local migration**

Run: `npm run db:migrate:local`
Expected: Migration applies successfully, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/0003_event_photos.sql
git commit -m "feat: add eventPhotos table schema and migration"
```

---

### Task 2: Database Query Functions

**Files:**
- Create: `src/lib/db/queries/event-photos.ts`

- [ ] **Step 1: Create the event-photos query module**

Create `src/lib/db/queries/event-photos.ts`:

```typescript
import { eq, and, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { newId } from "@/lib/ids";

export async function listPhotosForEvent(eventId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.eventPhotos)
    .where(eq(schema.eventPhotos.eventId, eventId))
    .orderBy(schema.eventPhotos.position)
    .all();
}

export async function syncEventPhotos(
  eventId: string,
  photos: { url: string; position: number }[],
) {
  const db = getDb();
  const now = Date.now();

  // Delete all existing photos for this event
  await db
    .delete(schema.eventPhotos)
    .where(eq(schema.eventPhotos.eventId, eventId));

  // Insert new set
  if (photos.length > 0) {
    await db.insert(schema.eventPhotos).values(
      photos.map((p) => ({
        id: newId(),
        eventId,
        url: p.url,
        position: p.position,
        createdAt: now,
      })),
    );
  }
}

export async function insertEventPhotos(
  eventId: string,
  photos: { url: string; position: number }[],
) {
  if (photos.length === 0) return;
  const db = getDb();
  const now = Date.now();
  await db.insert(schema.eventPhotos).values(
    photos.map((p) => ({
      id: newId(),
      eventId,
      url: p.url,
      position: p.position,
      createdAt: now,
    })),
  );
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `event-photos.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries/event-photos.ts
git commit -m "feat: add event photo DB query functions"
```

---

### Task 3: GalleryUpload Component

**Files:**
- Create: `src/components/dashboard/GalleryUpload.tsx`

- [ ] **Step 1: Create the GalleryUpload component**

Create `src/components/dashboard/GalleryUpload.tsx`:

```tsx
"use client";

import { useCallback, useRef, useState } from "react";

interface GalleryPhoto {
  url: string;
  position: number;
}

interface GalleryUploadProps {
  name: string;
  defaultValue?: GalleryPhoto[];
  max?: number;
  error?: string;
}

export function GalleryUpload({
  name,
  defaultValue = [],
  max = 5,
  error,
}: GalleryUploadProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(
    () => [...defaultValue].sort((a, b) => a.position - b.position),
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (photos.length >= max) return;
      setUploadError(null);
      setUploading(true);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/images/upload", { method: "POST", body });
        const data: { url?: string; error?: string } = await res.json();
        if (!res.ok) {
          setUploadError(data.error ?? "Błąd przesyłania");
          return;
        }
        setPhotos((prev) => [
          ...prev,
          { url: data.url!, position: prev.length },
        ]);
      } catch {
        setUploadError("Nie udało się przesłać pliku");
      } finally {
        setUploading(false);
      }
    },
    [photos.length, max],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, position: i })),
    );
  }, []);

  const movePhoto = useCallback((index: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((p, i) => ({ ...p, position: i }));
    });
  }, []);

  const displayError = uploadError ?? error;

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">
          Galeria zdjęć
        </label>
        <span className="text-xs text-muted-foreground">
          {photos.length} / {max} zdjęć
        </span>
      </div>

      {/* Hidden input carries the JSON value into the form */}
      <input type="hidden" name={name} value={JSON.stringify(photos)} />

      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <div
            key={photo.url}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/30" />
            <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => movePhoto(index, -1)}
                disabled={index === 0}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-xs text-white transition-colors hover:bg-black/80 disabled:opacity-30"
                title="Przesuń w lewo"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => movePhoto(index, 1)}
                disabled={index === photos.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-xs text-white transition-colors hover:bg-black/80 disabled:opacity-30"
                title="Przesuń w prawo"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-xs text-white transition-colors hover:bg-red-600"
                title="Usuń"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {photos.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-[4/3] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
          >
            {uploading ? (
              <span className="text-sm">Przesyłanie...</span>
            ) : (
              <>
                <span className="text-2xl leading-none">+</span>
                <span className="mt-1 text-xs">Dodaj zdjęcie</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onFileChange}
        className="sr-only"
        tabIndex={-1}
      />

      {displayError && (
        <p className="mt-1 text-sm text-destructive">{displayError}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `GalleryUpload.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/GalleryUpload.tsx
git commit -m "feat: add GalleryUpload component for multi-image upload"
```

---

### Task 4: Integrate Gallery into Event Edit Form

**Files:**
- Modify: `src/app/dashboard/events/[id]/EventEditForm.tsx`
- Modify: `src/app/dashboard/events/[id]/actions.ts:22-128`
- Modify: `src/app/dashboard/events/[id]/page.tsx:37-44,164-185`

- [ ] **Step 1: Add gallery props and section to EventEditForm**

In `src/app/dashboard/events/[id]/EventEditForm.tsx`:

Add the import at the top:
```typescript
import { GalleryUpload } from "@/components/dashboard/GalleryUpload";
```

Update the `Props` type to add `initialPhotos`:
```typescript
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
  initialPhotos: { url: string; position: number }[];
};
```

Add `initialPhotos` to the destructured props:
```typescript
export function EventEditForm({
  eventId,
  event,
  initialQuestions,
  initialConsents,
  initialPhotos,
  showCreationStep2 = false,
}: Props) {
```

Add a new `<Section>` block after the "Okładka" section (after line 162, before "Pytania do uczestnika"):
```tsx
      <Section title="Galeria zdjęć" description="Dodaj do 5 zdjęć prezentujących wydarzenie — np. miejsce, poprzednie edycje, atrakcje.">
        <GalleryUpload
          name="galleryPhotos"
          defaultValue={initialPhotos}
          max={5}
          error={state?.errors?.galleryPhotos}
        />
      </Section>
```

- [ ] **Step 2: Update saveEventAction to sync gallery photos**

In `src/app/dashboard/events/[id]/actions.ts`:

Add the import at the top:
```typescript
import { syncEventPhotos } from "@/lib/db/queries/event-photos";
```

After the existing `updateEvent(...)` call (around line 124), add gallery sync logic. Insert the following before the `revalidatePath` call:

```typescript
  // Sync gallery photos
  let galleryPhotos: { url: string; position: number }[] = [];
  try {
    const galleryRaw = String(formData.get("galleryPhotos") ?? "[]");
    const parsed = JSON.parse(galleryRaw);
    if (Array.isArray(parsed)) {
      galleryPhotos = parsed
        .filter(
          (p: unknown): p is { url: string; position: number } =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as Record<string, unknown>).url === "string" &&
            typeof (p as Record<string, unknown>).position === "number",
        )
        .slice(0, 5);
    }
  } catch {
    // Ignore malformed gallery data — keep existing photos
  }
  await syncEventPhotos(eventId, galleryPhotos);
```

- [ ] **Step 3: Load gallery photos in the event edit page**

In `src/app/dashboard/events/[id]/page.tsx`:

Add the import at the top:
```typescript
import { listPhotosForEvent } from "@/lib/db/queries/event-photos";
```

After where `initialConsents` is parsed (around line 43), add:
```typescript
  const eventPhotos = await listPhotosForEvent(id);
  const initialPhotos = eventPhotos.map((p) => ({ url: p.url, position: p.position }));
```

Update the `<EventEditForm>` component call to pass the new prop:
```tsx
          <EventEditForm
            eventId={id}
            showCreationStep2={
              event.status === "draft" && event.createdAt === event.updatedAt
            }
            event={{
              title: event.title,
              description: event.description,
              location: event.location,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              priceCents: event.priceCents,
              capacity: event.capacity,
              coverUrl: event.coverUrl,
              depositCents: event.depositCents ?? null,
              balanceDueAt: event.balanceDueAt ?? null,
            }}
            initialQuestions={questions}
            initialConsents={initialConsents}
            initialPhotos={initialPhotos}
          />
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/events/[id]/EventEditForm.tsx src/app/dashboard/events/[id]/actions.ts src/app/dashboard/events/[id]/page.tsx
git commit -m "feat: integrate gallery upload into event edit form"
```

---

### Task 5: Integrate Gallery into New Event Form

**Files:**
- Modify: `src/app/dashboard/events/new/page.tsx`
- Modify: `src/app/dashboard/events/new/actions.ts`

- [ ] **Step 1: Add gallery section to the new event form**

In `src/app/dashboard/events/new/page.tsx`:

Add the import at the top:
```typescript
import { GalleryUpload } from "@/components/dashboard/GalleryUpload";
```

Add the gallery section after the `ImageUpload` component (after line 125, before the `_form` error block):
```tsx
          <div>
            <GalleryUpload name="galleryPhotos" max={5} />
          </div>
```

Also add `"galleryPhotos"` to the preserved values list in actions.

- [ ] **Step 2: Update createEventAction to insert gallery photos**

In `src/app/dashboard/events/new/actions.ts`:

Add the import at the top:
```typescript
import { insertEventPhotos } from "@/lib/db/queries/event-photos";
```

After the `insertEvent(...)` call (around line 102), before the `redirect`, add:

```typescript
  // Insert gallery photos
  let galleryPhotos: { url: string; position: number }[] = [];
  try {
    const galleryRaw = String(formData.get("galleryPhotos") ?? "[]");
    const parsed = JSON.parse(galleryRaw);
    if (Array.isArray(parsed)) {
      galleryPhotos = parsed
        .filter(
          (p: unknown): p is { url: string; position: number } =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as Record<string, unknown>).url === "string" &&
            typeof (p as Record<string, unknown>).position === "number",
        )
        .slice(0, 5);
    }
  } catch {
    // Ignore malformed gallery data
  }
  await insertEventPhotos(id, galleryPhotos);
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/events/new/page.tsx src/app/dashboard/events/new/actions.ts
git commit -m "feat: integrate gallery upload into new event form"
```

---

### Task 6: PhotoGallery Component (Thumbnails + Lightbox)

**Files:**
- Create: `src/components/sites/PhotoGallery.tsx`

- [ ] **Step 1: Create the PhotoGallery component with thumbnail row and lightbox**

Create `src/components/sites/PhotoGallery.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

interface PhotoGalleryProps {
  photos: { url: string; position: number }[];
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const sorted = [...photos].sort((a, b) => a.position - b.position);

  const close = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(
    () =>
      setLightboxIndex((i) =>
        i !== null ? (i - 1 + sorted.length) % sorted.length : null,
      ),
    [sorted.length],
  );
  const next = useCallback(
    () =>
      setLightboxIndex((i) =>
        i !== null ? (i + 1) % sorted.length : null,
      ),
    [sorted.length],
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, close, prev, next]);

  if (sorted.length === 0) return null;

  return (
    <>
      {/* Thumbnail row */}
      <div className="mt-4 flex gap-2 overflow-x-auto px-6 pb-2">
        {sorted.map((photo, index) => (
          <button
            key={photo.url}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt=""
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Lightbox overlay */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Galeria zdjęć"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Zamknij"
          >
            ✕
          </button>

          {/* Prev button */}
          {sorted.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white transition-colors hover:bg-white/20"
              aria-label="Poprzednie zdjęcie"
            >
              ‹
            </button>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sorted[lightboxIndex].url}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next button */}
          {sorted.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white transition-colors hover:bg-white/20"
              aria-label="Następne zdjęcie"
            >
              ›
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
            {lightboxIndex + 1} / {sorted.length}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `PhotoGallery.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/sites/PhotoGallery.tsx
git commit -m "feat: add PhotoGallery component with thumbnails and lightbox"
```

---

### Task 7: Integrate Gallery into Public Event Page

**Files:**
- Modify: `src/app/sites/[subdomain]/[eventSlug]/page.tsx`

- [ ] **Step 1: Load gallery photos and render on the public page**

In `src/app/sites/[subdomain]/[eventSlug]/page.tsx`:

Add the imports at the top:
```typescript
import { listPhotosForEvent } from "@/lib/db/queries/event-photos";
import { PhotoGallery } from "@/components/sites/PhotoGallery";
```

Inside the `EventPage` component, after `const depositMode = ...` (around line 51), add:
```typescript
  const eventPhotos = await listPhotosForEvent(event.id);
  const galleryPhotos = eventPhotos.map((p) => ({ url: p.url, position: p.position }));
```

In the JSX, add the `PhotoGallery` component right after the hero/cover section, before `<div className="mx-auto max-w-3xl px-6">`. Place it between the closing `)}` of the hero conditional (line 87) and the opening of the `max-w-3xl` container (line 89):

```tsx
      {/* Gallery thumbnails */}
      {galleryPhotos.length > 0 && (
        <div className="mx-auto max-w-3xl">
          <PhotoGallery photos={galleryPhotos} />
        </div>
      )}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sites/[subdomain]/[eventSlug]/page.tsx
git commit -m "feat: display photo gallery on public event page"
```

---

### Task 8: Manual Testing & Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Server starts without errors.

- [ ] **Step 2: Test gallery in event edit form**

1. Navigate to `/dashboard/events/{some-event-id}` (edit an existing event)
2. Verify the "Galeria zdjęć" section appears between "Okładka" and "Pytania do uczestnika"
3. Click "Dodaj zdjęcie" — file picker opens
4. Upload an image — thumbnail appears in the grid
5. Upload up to 5 images — the "add" button disappears at 5
6. Test reorder arrows (← →) — photos swap positions
7. Test delete (✕) — photo is removed, counter updates
8. Click "Zapisz zmiany" — verify the page reloads with photos persisted

- [ ] **Step 3: Test gallery in new event form**

1. Navigate to `/dashboard/events/new`
2. Verify the gallery section appears after the cover image upload
3. Add a photo, fill in required fields, submit
4. Verify redirect to edit page shows the uploaded photo in the gallery

- [ ] **Step 4: Test public event page**

1. Publish an event that has gallery photos
2. Navigate to the public event URL
3. Verify thumbnail row appears below the hero image
4. Click a thumbnail — lightbox opens with full-size photo
5. Test keyboard navigation: ArrowLeft, ArrowRight, Escape
6. Test click-outside to close the lightbox
7. Verify the counter shows "X / Y"
8. Verify events without gallery photos show no thumbnail row

- [ ] **Step 5: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: address issues found during gallery manual testing"
```

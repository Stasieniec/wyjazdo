# Event Photo Gallery — Design Spec

## Summary

Add a multi-photo gallery to events, allowing organizers to upload up to 5 additional photos beyond the cover image. Photos are displayed as thumbnail row + lightbox on the public event page.

## Database

New `eventPhotos` table:

| Column      | Type    | Notes                              |
|-------------|---------|------------------------------------|
| `id`        | text PK | Generated via `newId()`            |
| `eventId`   | text FK | References `events.id`, cascade delete |
| `url`       | text    | Path like `/api/images/...`        |
| `position`  | integer | 0-based display ordering           |
| `createdAt` | integer | Timestamp in milliseconds          |

- Index on `eventId` for fast lookups.
- Max 5 photos per event enforced at the application/validation layer (not DB constraint).

## Event Edit Form — "Galeria zdjęć" Section

New section in `EventEditForm` placed **after the description field**, labeled "Galeria zdjęć".

**Layout:**
- Grid of thumbnail cards for existing photos, each with:
  - Photo thumbnail preview
  - Delete (X) button in the corner
  - Up/down arrows for position reordering
- "Add photo" card/button at end of grid (hidden when 5 photos reached)
- Counter: "X / 5 zdjęć"

**Upload flow:**
- Clicking "add" opens file picker
- File uploads immediately to `/api/images/upload` (existing R2 endpoint)
- On success, thumbnail appears in the grid
- Same constraints as existing uploads: 5MB max, JPEG/PNG/WebP/GIF

**Also available in the new event form** (`/dashboard/events/new`) so organizers can add gallery photos from the start.

**Saving:**
- On form submit, gallery state (URLs + positions) is serialized and sent to the server action
- Server action syncs `eventPhotos` table: insert new rows, delete removed ones, update positions
- Validation: max 5 photos, each URL must match `/api/images/` prefix or http(s)

## Public Event Page — Lightbox Thumbnails

On the participant-facing page (`/sites/[subdomain]/[eventSlug]`):

**Thumbnail row:**
- Positioned below the hero cover image, before the info grid
- Horizontal row of small thumbnails (~80x80px, rounded corners)
- Not rendered if the event has no gallery photos

**Lightbox:**
- Clicking any thumbnail opens a full-screen dark overlay with the photo displayed large
- Left/right navigation arrows to cycle through photos
- Close via X button, click-outside, or Escape key
- Smooth transitions between photos

**Implementation:** Custom lightweight lightbox component built with Tailwind + React state. No external dependency.

## Upload Infrastructure

No changes needed. Reuses existing:
- `/api/images/upload` POST endpoint (Cloudflare R2 storage)
- `ImageUpload` component patterns (file picker, drag-and-drop)
- 5MB file size limit, JPEG/PNG/WebP/GIF format restrictions

## Files to Create/Modify

**Create:**
- `eventPhotos` table definition in `src/lib/db/schema.ts`
- Gallery upload component (multi-image variant)
- Lightbox component for public page

**Modify:**
- `src/app/dashboard/events/new/page.tsx` — add gallery section
- `src/app/dashboard/events/new/actions.ts` — handle gallery photos on create
- `src/app/dashboard/events/[id]/EventEditForm.tsx` — add gallery section
- `src/app/dashboard/events/[id]/actions.ts` — sync gallery photos on update
- `src/app/sites/[subdomain]/[eventSlug]/page.tsx` — add thumbnail row + lightbox
- DB migration for new table

## Validation

- Max 5 gallery photos per event
- Each URL must start with `/api/images/` or `http`
- Position must be a non-negative integer
- Standard file upload validations (size, format) handled by existing upload endpoint

## Out of Scope

- Per-photo captions or alt text (can be added later via new columns)
- Participant photo uploads
- Drag-to-reorder (using up/down arrows instead for simplicity)

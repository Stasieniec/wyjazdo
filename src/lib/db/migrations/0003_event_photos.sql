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

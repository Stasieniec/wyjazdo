-- 0004_multi_attendee.sql
-- Adds: events.attendee_types (JSON) and the attendees table for multi-attendee registrations.

ALTER TABLE `events` ADD COLUMN `attendee_types` text;
--> statement-breakpoint

CREATE TABLE `attendees` (
  `id` text PRIMARY KEY NOT NULL,
  `participant_id` text NOT NULL,
  `attendee_type_id` text NOT NULL,
  `first_name` text NOT NULL,
  `last_name` text NOT NULL,
  `custom_answers` text,
  `cancelled_at` integer,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attendees_participant_active_idx` ON `attendees` (`participant_id`, `cancelled_at`);

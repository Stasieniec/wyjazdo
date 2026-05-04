-- 0006_event_creation_step.sql
-- Adds wizard-resume tracking and first-publish timestamp.
-- creation_step: NULL = legacy row (pre-wizard) OR pre-existing event;
--                step id (e.g. 'opis', 'termin') = wizard in progress, resume here;
--                'complete' = wizard finished, awaiting first publish (or already published).
-- published_at: NULL until first publish; set once and never reset.

ALTER TABLE `events` ADD COLUMN `creation_step` text;
--> statement-breakpoint
ALTER TABLE `events` ADD COLUMN `published_at` integer;
--> statement-breakpoint
-- Backfill published_at for pre-existing published rows (per spec).
UPDATE `events` SET `published_at` = `updated_at` WHERE `status` = 'published';

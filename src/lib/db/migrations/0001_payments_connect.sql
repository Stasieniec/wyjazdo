-- 0001_payments_connect.sql
-- Adds: payments table, Connect columns on organizers, deposit columns on events.
-- Changes: participants.status -> lifecycle_status; drops participants payment cols.

CREATE TABLE `payments` (
  `id` text PRIMARY KEY NOT NULL,
  `participant_id` text NOT NULL,
  `kind` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `currency` text DEFAULT 'PLN' NOT NULL,
  `status` text NOT NULL,
  `due_at` integer,
  `stripe_session_id` text,
  `stripe_payment_intent_id` text,
  `stripe_application_fee` integer,
  `last_reminder_at` integer,
  `paid_at` integer,
  `expires_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_participant_idx` ON `payments` (`participant_id`);--> statement-breakpoint
CREATE INDEX `payments_stripe_session_idx` ON `payments` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `payments_status_due_idx` ON `payments` (`status`,`due_at`);--> statement-breakpoint

ALTER TABLE `organizers` ADD COLUMN `stripe_account_id` text;--> statement-breakpoint
ALTER TABLE `organizers` ADD COLUMN `stripe_onboarding_complete` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organizers` ADD COLUMN `stripe_payouts_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organizers` ADD COLUMN `stripe_account_synced_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `organizers_stripe_account_uniq` ON `organizers` (`stripe_account_id`);--> statement-breakpoint

ALTER TABLE `events` ADD COLUMN `deposit_cents` integer;--> statement-breakpoint
ALTER TABLE `events` ADD COLUMN `balance_due_at` integer;--> statement-breakpoint

ALTER TABLE `participants` RENAME COLUMN `status` TO `lifecycle_status`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `expires_at`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `stripe_session_id`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `stripe_payment_intent_id`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `amount_paid_cents`;--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `paid_at`;--> statement-breakpoint
DROP INDEX IF EXISTS `participants_event_status_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `participants_stripe_session_idx`;--> statement-breakpoint
CREATE INDEX `participants_event_lifecycle_idx` ON `participants` (`event_id`,`lifecycle_status`);--> statement-breakpoint

-- Any existing rows in dev: collapse to the new value set.
UPDATE `participants` SET `lifecycle_status` = 'active' WHERE `lifecycle_status` IN ('pending','paid','refunded');--> statement-breakpoint
UPDATE `participants` SET `lifecycle_status` = 'cancelled' WHERE `lifecycle_status` NOT IN ('active','waitlisted','cancelled');

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
CREATE UNIQUE INDEX `legal_documents_type_version_uniq` ON `legal_documents` (`type`, `version`);
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

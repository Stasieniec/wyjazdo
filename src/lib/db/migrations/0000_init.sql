CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`organizer_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`location` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text DEFAULT 'PLN' NOT NULL,
	`capacity` integer NOT NULL,
	`cover_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`custom_questions` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `organizers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_organizer_idx` ON `events` (`organizer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_organizer_slug_uniq` ON `events` (`organizer_id`,`slug`);--> statement-breakpoint
CREATE TABLE `organizers` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`subdomain` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`logo_url` text,
	`cover_url` text,
	`brand_color` text,
	`contact_email` text,
	`contact_phone` text,
	`social_links` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizers_clerk_user_id_unique` ON `organizers` (`clerk_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `organizers_subdomain_unique` ON `organizers` (`subdomain`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`custom_answers` text,
	`status` text NOT NULL,
	`expires_at` integer,
	`stripe_session_id` text,
	`stripe_payment_intent_id` text,
	`amount_paid_cents` integer,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `participants_event_status_idx` ON `participants` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `participants_stripe_session_idx` ON `participants` (`stripe_session_id`);
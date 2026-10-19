-- 0008_leads.sql
-- Call-back requests from the landing page contact dialog.
-- contact is a normalised phone number (+48XXXXXXXXX) or a lower-case email.
-- handled_at stays NULL until someone has called or written back.

CREATE TABLE `leads` (
  `id` text PRIMARY KEY NOT NULL,
  `contact` text NOT NULL,
  `name` text,
  `created_at` integer NOT NULL,
  `ip` text,
  `user_agent` text,
  `handled_at` integer
);
--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`created_at`);

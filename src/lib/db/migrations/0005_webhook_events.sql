-- 0005_webhook_events.sql
-- Adds idempotency table for Stripe webhook event IDs.
-- Handler does INSERT OR IGNORE and short-circuits if the row already exists.

CREATE TABLE `processed_webhook_events` (
  `event_id` text PRIMARY KEY NOT NULL,
  `event_type` text NOT NULL,
  `processed_at` integer NOT NULL
);

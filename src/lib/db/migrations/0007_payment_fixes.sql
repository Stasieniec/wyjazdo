-- 0007_payment_fixes.sql
-- refunded_amount_cents: cumulative amount refunded on a payment. A payment
--   only gets status 'refunded' once it is fully refunded; partial refunds
--   keep 'succeeded' and record the amount here.
-- attendees.price_cents: price of this attendee at registration time, so a
--   later price edit by the organizer does not change what a guest owes.
--   NULL for rows created before this migration (falls back to current price).
-- participants.attention_reason / attention_at: set when something needs the
--   organizer's attention (a payment arrived that overbooks the event, a
--   cancelled participant paid, or a second payment arrived for the same row).
-- Emails are normalised to lower case so the /my-trips lookup matches.

ALTER TABLE `payments` ADD COLUMN `refunded_amount_cents` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `payments` SET `refunded_amount_cents` = `amount_cents` WHERE `status` = 'refunded';
--> statement-breakpoint
ALTER TABLE `attendees` ADD COLUMN `price_cents` integer;
--> statement-breakpoint
ALTER TABLE `participants` ADD COLUMN `attention_reason` text;
--> statement-breakpoint
ALTER TABLE `participants` ADD COLUMN `attention_at` integer;
--> statement-breakpoint
UPDATE `participants` SET `email` = lower(trim(`email`));
--> statement-breakpoint
CREATE INDEX `payments_stripe_pi_idx` ON `payments` (`stripe_payment_intent_id`);

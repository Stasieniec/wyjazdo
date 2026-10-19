import type Stripe from "stripe";

export type WebhookDeps = {
  markPaymentSucceeded(params: {
    paymentId: string;
    stripePaymentIntentId: string;
    amountCents: number;
    applicationFeeCents: number | null;
    paidAt: number;
  }): Promise<boolean>;
  /** Only acts if the row still points at `sessionId`. */
  markPaymentExpired(paymentId: string, sessionId: string | null): Promise<void>;
  markPaymentFailed(paymentId: string, sessionId: string | null): Promise<void>;
  recordRefund(params: {
    paymentIntentId: string;
    amountRefundedCents: number;
    fullyRefunded: boolean;
  }): Promise<void>;
  syncOrganizerFromAccount(params: {
    accountId: string;
    onboardingComplete: boolean;
    payoutsEnabled: boolean;
  }): Promise<void>;
  /** True if this event.id was already handled successfully. */
  isEventProcessed(eventId: string): Promise<boolean>;
  /** Called only after the event was handled without error. */
  recordProcessedEvent(params: { eventId: string; eventType: string }): Promise<void>;
  now(): number;
};

function paymentIdFromMetadata(meta: Stripe.Metadata | null | undefined): string | null {
  if (!meta) return null;
  const v = meta.payment_id;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function paymentIntentId(s: Stripe.Checkout.Session): string {
  return typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? "";
}

async function succeedFromSession(s: Stripe.Checkout.Session, deps: WebhookDeps) {
  const paymentId = paymentIdFromMetadata(s.metadata);
  if (!paymentId) return;
  await deps.markPaymentSucceeded({
    paymentId,
    stripePaymentIntentId: paymentIntentId(s),
    amountCents: s.amount_total ?? 0,
    applicationFeeCents: null,
    paidAt: deps.now(),
  });
}

/**
 * Handles one Stripe event. Every branch is idempotent (conditional updates,
 * emails only on a state transition), so the event is recorded as processed
 * only after the work succeeded: a crash mid-way leaves it unrecorded and
 * Stripe's retry does the work again.
 */
export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<void> {
  if (await deps.isEventProcessed(event.id)) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      // With a delayed-notification method the session completes before the
      // money moves (payment_status 'unpaid'); the async events settle it.
      if (s.payment_status === "paid" || s.payment_status === "no_payment_required") {
        await succeedFromSession(s, deps);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      await succeedFromSession(event.data.object as Stripe.Checkout.Session, deps);
      break;
    }
    case "checkout.session.async_payment_failed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const paymentId = paymentIdFromMetadata(s.metadata);
      if (paymentId) await deps.markPaymentFailed(paymentId, s.id);
      break;
    }
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const paymentId = paymentIdFromMetadata(s.metadata);
      if (paymentId) await deps.markPaymentExpired(paymentId, s.id);
      break;
    }
    case "payment_intent.payment_failed": {
      // A declined attempt inside Checkout does not end the session: the
      // guest can retry with another card or BLIK until it expires. The row
      // stays pending (and keeps the place) until checkout.session.expired
      // or async_payment_failed.
      break;
    }
    case "charge.refunded": {
      const ch = event.data.object as Stripe.Charge;
      const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (!pi) break;
      await deps.recordRefund({
        paymentIntentId: pi,
        amountRefundedCents: ch.amount_refunded,
        fullyRefunded: ch.refunded === true || ch.amount_refunded >= ch.amount,
      });
      break;
    }
    case "account.updated": {
      const a = event.data.object as Stripe.Account;
      await deps.syncOrganizerFromAccount({
        accountId: a.id,
        onboardingComplete: Boolean(a.details_submitted) && Boolean(a.charges_enabled),
        payoutsEnabled: Boolean(a.payouts_enabled),
      });
      break;
    }
    default:
      return;
  }

  await deps.recordProcessedEvent({ eventId: event.id, eventType: event.type });
}

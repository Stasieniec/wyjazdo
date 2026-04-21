import type Stripe from "stripe";

export type WebhookDeps = {
  markPaymentSucceeded(params: {
    paymentId: string;
    stripePaymentIntentId: string;
    amountCents: number;
    applicationFeeCents: number | null;
    paidAt: number;
  }): Promise<boolean>;
  markPaymentExpired(paymentId: string): Promise<void>;
  markPaymentFailed(paymentId: string): Promise<void>;
  markPaymentRefunded(paymentIntentId: string): Promise<void>;
  syncOrganizerFromAccount(params: {
    accountId: string;
    onboardingComplete: boolean;
    payoutsEnabled: boolean;
  }): Promise<void>;
  /**
   * Returns true if this event.id has not been processed before (caller should
   * process), false if it was already processed (caller must short-circuit).
   */
  recordProcessedEvent(params: { eventId: string; eventType: string }): Promise<boolean>;
  now(): number;
};

function paymentIdFromMetadata(meta: Stripe.Metadata | null | undefined): string | null {
  if (!meta) return null;
  const v = meta.payment_id;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<void> {
  const fresh = await deps.recordProcessedEvent({ eventId: event.id, eventType: event.type });
  if (!fresh) return;
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const paymentId = paymentIdFromMetadata(s.metadata);
      if (!paymentId) return;
      const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? "";
      await deps.markPaymentSucceeded({
        paymentId,
        stripePaymentIntentId: pi,
        amountCents: s.amount_total ?? 0,
        applicationFeeCents: null,
        paidAt: deps.now(),
      });
      return;
    }
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const paymentId = paymentIdFromMetadata(s.metadata);
      if (!paymentId) return;
      await deps.markPaymentExpired(paymentId);
      return;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentId = paymentIdFromMetadata(pi.metadata);
      if (!paymentId) return;
      await deps.markPaymentFailed(paymentId);
      return;
    }
    case "charge.refunded": {
      const ch = event.data.object as Stripe.Charge;
      const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (!pi) return;
      await deps.markPaymentRefunded(pi);
      return;
    }
    case "account.updated": {
      const a = event.data.object as Stripe.Account;
      await deps.syncOrganizerFromAccount({
        accountId: a.id,
        onboardingComplete: Boolean(a.details_submitted) && Boolean(a.charges_enabled),
        payoutsEnabled: Boolean(a.payouts_enabled),
      });
      return;
    }
    default:
      return;
  }
}

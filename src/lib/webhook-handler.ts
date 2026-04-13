import type Stripe from "stripe";

export type WebhookDeps = {
  markPaid(params: {
    participantId: string;
    paymentIntentId: string;
    amountCents: number;
    paidAt: number;
  }): Promise<void>;
  cancel(participantId: string): Promise<void>;
  now(): number;
};

export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const pid = s.metadata?.participant_id;
      if (!pid) return;
      await deps.markPaid({
        participantId: pid,
        paymentIntentId:
          typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? "",
        amountCents: s.amount_total ?? 0,
        paidAt: deps.now(),
      });
      return;
    }
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const pid = s.metadata?.participant_id;
      if (!pid) return;
      await deps.cancel(pid);
      return;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const pid = pi.metadata?.participant_id;
      if (!pid) return;
      await deps.cancel(pid);
      return;
    }
    default:
      return;
  }
}

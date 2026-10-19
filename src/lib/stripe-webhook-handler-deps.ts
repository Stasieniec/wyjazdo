import {
  markPaymentExpiredIfPending,
  markPaymentFailedIfPending,
  recordPaymentRefund,
} from "@/lib/db/queries/payments";
import { syncOrganizerStripeState } from "@/lib/db/queries/organizers";
import {
  isWebhookEventProcessed,
  recordProcessedWebhookEvent,
} from "@/lib/db/queries/webhook-events";
import { recordPaymentSuccess } from "@/lib/register/payment-outcomes";
import type { WebhookDeps } from "@/lib/webhook-handler";

export function buildWebhookDeps(): WebhookDeps {
  return {
    markPaymentSucceeded: (params) =>
      recordPaymentSuccess({
        paymentId: params.paymentId,
        providerPaymentId: params.stripePaymentIntentId,
        amountCents: params.amountCents,
        paidAt: params.paidAt,
      }),
    markPaymentExpired: markPaymentExpiredIfPending,
    markPaymentFailed: markPaymentFailedIfPending,
    recordRefund: recordPaymentRefund,
    syncOrganizerFromAccount: syncOrganizerStripeState,
    isEventProcessed: isWebhookEventProcessed,
    recordProcessedEvent: async (params) => {
      await recordProcessedWebhookEvent({
        eventId: params.eventId,
        eventType: params.eventType,
        nowMs: Date.now(),
      });
    },
    now: () => Date.now(),
  };
}

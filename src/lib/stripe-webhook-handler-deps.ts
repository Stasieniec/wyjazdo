import {
  markPaymentSucceededIfPending,
  markPaymentExpiredIfPending,
  markPaymentFailedIfPending,
  markPaymentRefunded,
  getPaymentById,
} from "@/lib/db/queries/payments";
import { getParticipantWithContext } from "@/lib/db/queries/participants";
import { syncOrganizerStripeState } from "@/lib/db/queries/organizers";
import { sendPaymentConfirmation, sendOrganizerNewRegistration } from "@/lib/email/send";
import { dashboardEventUrl, publicEventUrl } from "@/lib/urls";
import { countTakenSpots } from "@/lib/capacity";
import type { WebhookDeps } from "@/lib/webhook-handler";

export function buildWebhookDeps(): WebhookDeps {
  return {
    markPaymentSucceeded: async (params) => {
      const transitioned = await markPaymentSucceededIfPending(params);
      if (!transitioned) return false;
      const payment = await getPaymentById(params.paymentId);
      if (!payment) return true;
      const ctx = await getParticipantWithContext(payment.participantId);
      if (!ctx) return true;

      const dateStr = new Date(ctx.event.startsAt).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const emailPromises: Promise<void>[] = [
        sendPaymentConfirmation({
          to: ctx.participant.email,
          participantName: ctx.participant.firstName,
          eventTitle: ctx.event.title,
          eventDate: dateStr,
          eventLocation: ctx.event.location,
          eventUrl: publicEventUrl(ctx.organizer.subdomain, ctx.event.slug),
          organizerName: ctx.organizer.displayName,
          paymentKind: payment.kind,
          amountCents: payment.amountCents,
        }),
      ];

      if (ctx.organizer.contactEmail) {
        const taken = await countTakenSpots(ctx.event.id, Date.now());
        emailPromises.push(
          sendOrganizerNewRegistration({
            to: ctx.organizer.contactEmail,
            participantName: `${ctx.participant.firstName} ${ctx.participant.lastName}`,
            participantEmail: ctx.participant.email,
            eventTitle: ctx.event.title,
            spotsInfo: `${taken} / ${ctx.event.capacity}`,
            isWaitlisted: false,
            dashboardUrl: dashboardEventUrl(ctx.event.id),
          }),
        );
      }

      await Promise.allSettled(emailPromises);
      return true;
    },
    markPaymentExpired: markPaymentExpiredIfPending,
    markPaymentFailed: markPaymentFailedIfPending,
    markPaymentRefunded: markPaymentRefunded,
    syncOrganizerFromAccount: syncOrganizerStripeState,
    now: () => Date.now(),
  };
}

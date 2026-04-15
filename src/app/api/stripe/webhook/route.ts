import { NextRequest } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/webhook-handler";
import {
  markPaidIfPending,
  cancelIfPending,
  getParticipantWithContext,
} from "@/lib/db/queries/participants";
import { countTakenSpots } from "@/lib/capacity";
import {
  sendRegistrationConfirmation,
  sendOrganizerNewRegistration,
} from "@/lib/email/send";
import { dashboardEventUrl, publicEventUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const body = await req.text();

  const stripe = getStripe();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, getWebhookSecret());
  } catch (err) {
    console.error("webhook signature verification failed", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event, {
      markPaid: async (params) => {
        // Atomic: only true if this call transitioned pending → paid.
        // Stripe webhook retries on the same session will return false and skip emails.
        const wasFirstTransition = await markPaidIfPending(params);
        if (!wasFirstTransition) return;

        const ctx = await getParticipantWithContext(params.participantId);
        if (!ctx) return;

        const dateStr = new Date(ctx.event.startsAt).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const emailPromises: Promise<void>[] = [
          sendRegistrationConfirmation({
            to: ctx.participant.email,
            participantName: ctx.participant.firstName,
            eventTitle: ctx.event.title,
            eventDate: dateStr,
            eventLocation: ctx.event.location,
            eventUrl: publicEventUrl(ctx.organizer.subdomain, ctx.event.slug),
            organizerName: ctx.organizer.displayName,
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
      },
      cancel: cancelIfPending,
      now: () => Date.now(),
    });
  } catch (err) {
    console.error("webhook processing error", err);
    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}

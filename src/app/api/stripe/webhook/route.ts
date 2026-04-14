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

export const dynamic = "force-dynamic";

function eventUrl(subdomain: string, slug: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";
  return `https://${subdomain}.${root}/${slug}`;
}

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
        await markPaidIfPending(params);

        // Send emails after successful payment
        const ctx = await getParticipantWithContext(params.participantId);
        if (ctx && ctx.participant.status === "paid") {
          const dateStr = new Date(ctx.event.startsAt).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          const url = eventUrl(ctx.organizer.subdomain, ctx.event.slug);

          // Fire both emails concurrently, don't block the webhook response
          const emailPromises: Promise<void>[] = [];

          emailPromises.push(
            sendRegistrationConfirmation({
              to: ctx.participant.email,
              participantName: ctx.participant.firstName,
              eventTitle: ctx.event.title,
              eventDate: dateStr,
              eventLocation: ctx.event.location,
              eventUrl: url,
              organizerName: ctx.organizer.displayName,
            }),
          );

          if (ctx.organizer.contactEmail) {
            const now = Date.now();
            const taken = await countTakenSpots(ctx.event.id, now);
            emailPromises.push(
              sendOrganizerNewRegistration({
                to: ctx.organizer.contactEmail,
                participantName: `${ctx.participant.firstName} ${ctx.participant.lastName}`,
                participantEmail: ctx.participant.email,
                eventTitle: ctx.event.title,
                spotsInfo: `${taken} / ${ctx.event.capacity}`,
                isWaitlisted: false,
                dashboardUrl: `https://wyjazdo.pl/dashboard/events/${ctx.event.id}`,
              }),
            );
          }

          await Promise.allSettled(emailPromises);
        }
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

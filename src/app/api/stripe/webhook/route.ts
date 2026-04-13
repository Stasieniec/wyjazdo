import { NextRequest } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/webhook-handler";
import { markPaidIfPending, cancelIfPending } from "@/lib/db/queries/participants";

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
      markPaid: markPaidIfPending,
      cancel: cancelIfPending,
      now: () => Date.now(),
    });
  } catch (err) {
    console.error("webhook processing error", err);
    // Return 200 to prevent retry storms on malformed data; log for investigation
    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}

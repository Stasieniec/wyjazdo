import { NextRequest } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/webhook-handler";
import { buildWebhookDeps } from "@/lib/stripe-webhook-handler-deps";

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
    await handleStripeEvent(event, buildWebhookDeps());
  } catch (err) {
    console.error("webhook processing error", err);
    return new Response("ok", { status: 200 });
  }
  return new Response("ok", { status: 200 });
}

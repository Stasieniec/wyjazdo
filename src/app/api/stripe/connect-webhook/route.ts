import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleStripeEvent } from "@/lib/webhook-handler";
import { buildWebhookDeps } from "@/lib/stripe-webhook-handler-deps";

export const dynamic = "force-dynamic";

function getConnectWebhookSecret(): string {
  const { env } = getCloudflareContext();
  const s = (env as unknown as { STRIPE_CONNECT_WEBHOOK_SECRET?: string }).STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!s) throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET not set");
  return s;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const body = await req.text();

  const stripe = getStripe();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, getConnectWebhookSecret());
  } catch (err) {
    console.error("connect webhook signature verification failed", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event, buildWebhookDeps());
  } catch (err) {
    console.error("connect webhook processing error", { eventId: event.id, eventType: event.type, err });
    return new Response("handler error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}

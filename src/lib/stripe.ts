import Stripe from "stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getStripe(): Stripe {
  const { env } = getCloudflareContext();
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, {
    // Use fetch-based HTTP client (required on Workers, no Node http)
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getWebhookSecret(): string {
  const { env } = getCloudflareContext();
  const s = env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  return s;
}

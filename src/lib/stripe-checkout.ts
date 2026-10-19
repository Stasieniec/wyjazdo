import { getStripe } from "@/lib/stripe";

/**
 * Thin wrappers around Stripe Checkout. Business decisions (amounts, whether
 * a place is held) live in the callers; this file only talks to Stripe.
 */

export async function createCheckoutSession(params: {
  stripeAccountId: string;
  customerEmail: string;
  amountCents: number;
  productName: string;
  paymentId: string;
  participantId: string;
  successUrl: string;
  cancelUrl: string;
  expiresAtMs: number;
}): Promise<{ id: string; url: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: params.customerEmail,
      line_items: [
        {
          price_data: {
            currency: "pln",
            unit_amount: params.amountCents,
            product_data: { name: params.productName },
          },
          quantity: 1,
        },
      ],
      metadata: { payment_id: params.paymentId, participant_id: params.participantId },
      payment_intent_data: {
        application_fee_amount: 0,
        metadata: { payment_id: params.paymentId, participant_id: params.participantId },
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      expires_at: Math.floor(params.expiresAtMs / 1000),
    },
    { stripeAccount: params.stripeAccountId },
  );
  if (!session.url) throw new Error("checkout session has no url");
  return { id: session.id, url: session.url };
}

export type ExistingSessionState =
  | { state: "open"; url: string; amountCents: number | null }
  /** paid is false for a delayed-notification payment still processing or failed. */
  | { state: "complete"; paid: boolean }
  | { state: "gone" };

/**
 * Whether an existing session forbids creating a new one for the same row.
 * A completed, paid session does (its webhook is on the way), and so does a
 * completed session whose delayed payment is still processing (row pending).
 * A completed session whose delayed payment failed (row failed) does not:
 * Stripe keeps reporting it as complete, but nothing will be charged.
 */
export function sessionBlocksNewCheckout(
  state: ExistingSessionState,
  rowStatus: "pending" | "succeeded" | "expired" | "failed" | "refunded",
): boolean {
  return state.state === "complete" && (state.paid || rowStatus === "pending");
}

export async function getCheckoutSessionState(
  stripeAccountId: string,
  sessionId: string,
): Promise<ExistingSessionState> {
  const stripe = getStripe();
  const s = await stripe.checkout.sessions.retrieve(sessionId, undefined, {
    stripeAccount: stripeAccountId,
  });
  if (s.status === "complete") return { state: "complete", paid: s.payment_status !== "unpaid" };
  if (s.status === "open" && s.url) return { state: "open", url: s.url, amountCents: s.amount_total };
  return { state: "gone" };
}

/**
 * Makes sure an old checkout session can no longer be paid, so a new one can
 * be created without risking a double charge. Returns "complete" when the old
 * session was already paid (its webhook may still be on the way); the caller
 * must not create a new session in that case.
 */
export async function closeCheckoutSession(
  stripeAccountId: string,
  sessionId: string,
): Promise<"closed" | "complete"> {
  const stripe = getStripe();
  const current = await getCheckoutSessionState(stripeAccountId, sessionId);
  if (current.state === "complete") return "complete";
  if (current.state === "gone") return "closed";
  try {
    await stripe.checkout.sessions.expire(sessionId, undefined, { stripeAccount: stripeAccountId });
    return "closed";
  } catch (err) {
    // Expire fails if the session completed in the meantime. Re-check.
    const after = await getCheckoutSessionState(stripeAccountId, sessionId);
    if (after.state === "complete") return "complete";
    if (after.state === "gone") return "closed";
    throw err;
  }
}

import { getStripe } from "@/lib/stripe";
import { newId } from "@/lib/ids";
import {
  insertPayment,
  setPaymentStripeSession,
  listPaymentsForParticipant,
} from "@/lib/db/queries/payments";
import type { Participant, Event, Organizer } from "@/lib/db/schema";
import { computeRegistrationAmountsCents } from "./compute-registration-amounts";

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Ensure a pending 'balance' payment row exists with an active Stripe Checkout Session.
 * Returns the Session URL for redirection. Idempotent if an existing pending session is still open.
 */
export async function ensureBalancePayment(params: {
  participant: Participant;
  event: Event;
  organizer: Organizer;
  origin: string;
}): Promise<string> {
  const { participant, event, organizer, origin } = params;
  if (!organizer.stripeAccountId) throw new Error("organizer not connected");
  if (event.depositCents == null || event.depositCents === 0) {
    throw new Error("event is not deposit-mode");
  }

  const { totalCents, effectiveDepositCents } = await computeRegistrationAmountsCents(participant.id, event);
  const balanceAmount = Math.max(0, totalCents - effectiveDepositCents);
  if (balanceAmount === 0) {
    throw new Error("nothing due — balance already covered");
  }

  const existing = await listPaymentsForParticipant(participant.id);
  const existingBalance = existing.find((p) => p.kind === "balance");
  const now = Date.now();

  const stripe = getStripe();

  let paymentId: string;

  if (existingBalance?.status === "succeeded") {
    throw new Error("balance already paid");
  }

  if (existingBalance && existingBalance.status === "pending" && existingBalance.stripeSessionId) {
    try {
      const s = await stripe.checkout.sessions.retrieve(
        existingBalance.stripeSessionId,
        undefined,
        { stripeAccount: organizer.stripeAccountId },
      );
      if (s.status === "open" && s.url) return s.url;
    } catch {
      // fall through and replace
    }
    paymentId = existingBalance.id;
  } else {
    paymentId = newId();
    await insertPayment({
      id: paymentId,
      participantId: participant.id,
      kind: "balance",
      amountCents: balanceAmount,
      currency: "PLN",
      status: "pending",
      dueAt: event.balanceDueAt ?? null,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      stripeApplicationFee: null,
      lastReminderAt: null,
      paidAt: null,
      expiresAt: now + PENDING_TTL_MS,
      createdAt: now,
      updatedAt: now,
    });
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: participant.email,
      line_items: [
        {
          price_data: {
            currency: "pln",
            unit_amount: balanceAmount,
            product_data: { name: `Dopłata — ${event.title}` },
          },
          quantity: 1,
        },
      ],
      metadata: { payment_id: paymentId, participant_id: participant.id },
      payment_intent_data: {
        application_fee_amount: 0,
        metadata: { payment_id: paymentId, participant_id: participant.id },
      },
      success_url: `${origin}/my-trips/${participant.id}`,
      cancel_url: `${origin}/my-trips/${participant.id}`,
      expires_at: Math.floor((now + PENDING_TTL_MS) / 1000),
    },
    { stripeAccount: organizer.stripeAccountId },
  );
  await setPaymentStripeSession(paymentId, session.id);
  if (!session.url) throw new Error("no session url");
  return session.url;
}

import { newId } from "@/lib/ids";
import {
  insertBalancePaymentIfAbsent,
  listPaymentsForParticipant,
  markPaymentFailedIfPending,
  reopenPayment,
  setPaymentStripeSession,
} from "@/lib/db/queries/payments";
import type { Participant, Event, Organizer, Payment } from "@/lib/db/schema";
import { computeRegistrationAmountsCents } from "./compute-registration-amounts";
import { signParticipantToken, getParticipantAuthSecret } from "@/lib/participant-auth";
import { totalNetPaidCents } from "@/lib/participant-status";
import { balanceOwedCents, MIN_CHARGE_CENTS } from "@/lib/payment-plan";
import {
  closeCheckoutSession,
  createCheckoutSession,
  getCheckoutSessionState,
} from "@/lib/stripe-checkout";
import { CheckoutBlockedError } from "./first-payment";

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/** Balance rows that can be reused for a new checkout (never inserted twice). */
function reusableBalanceRow(payments: Payment[]): Payment | undefined {
  return payments
    .filter((p) => p.kind === "balance" && p.status !== "refunded" && p.status !== "succeeded")
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/**
 * Gives a participant a checkout link for the rest of what they owe.
 *
 * The amount is the registration total minus what was actually paid (net of
 * partial refunds), not "total minus current deposit setting", so organizer
 * edits to the deposit or price cannot skew it.
 *
 * Keeps at most one live balance row: an expired or failed row is reused, a
 * pending row with a still-open session of the right amount is returned as
 * is, and an old session is expired before a new one is created. If the old
 * session was already paid (webhook not here yet) no new one is created.
 */
export async function ensureBalancePayment(params: {
  participant: Participant;
  event: Event;
  organizer: Organizer;
  origin: string;
  nowMs?: number;
}): Promise<string> {
  const { participant, event, organizer, origin } = params;
  const now = params.nowMs ?? Date.now();
  if (!organizer.stripeAccountId) throw new Error("organizer not connected");
  if (participant.lifecycleStatus !== "active") throw new CheckoutBlockedError("not_active");

  const payments = await listPaymentsForParticipant(participant.id);
  if (!payments.some((p) => p.kind === "deposit" && p.status === "succeeded")) {
    throw new CheckoutBlockedError("nothing_to_pay");
  }
  if (payments.some((p) => p.status === "refunded")) throw new CheckoutBlockedError("not_active");

  const { totalCents } = await computeRegistrationAmountsCents(participant.id, event);
  const owed = balanceOwedCents(totalCents, totalNetPaidCents(payments));
  if (owed === 0) throw new CheckoutBlockedError("already_paid");
  if (owed < MIN_CHARGE_CENTS) throw new CheckoutBlockedError("below_minimum");

  const accountId = organizer.stripeAccountId;
  const expiresAt = now + PENDING_TTL_MS;
  let row = reusableBalanceRow(payments);

  if (row?.status === "pending" && row.stripeSessionId) {
    const state = await getCheckoutSessionState(accountId, row.stripeSessionId);
    if (state.state === "complete") throw new CheckoutBlockedError("payment_in_progress");
    if (state.state === "open" && state.amountCents === owed && row.amountCents === owed) {
      return state.url;
    }
    if (state.state === "open") {
      const closed = await closeCheckoutSession(accountId, row.stripeSessionId);
      if (closed === "complete") throw new CheckoutBlockedError("payment_in_progress");
    }
  } else if (row?.stripeSessionId) {
    // Expired or failed row: its session should be dead, but make sure a
    // late completion is not about to land before reusing the row.
    const state = await getCheckoutSessionState(accountId, row.stripeSessionId);
    if (state.state === "complete") throw new CheckoutBlockedError("payment_in_progress");
    if (state.state === "open") {
      const closed = await closeCheckoutSession(accountId, row.stripeSessionId);
      if (closed === "complete") throw new CheckoutBlockedError("payment_in_progress");
    }
  }

  if (row) {
    const ok = await reopenPayment({
      paymentId: row.id,
      kind: "balance",
      amountCents: owed,
      expiresAt,
      allowedStatuses: ["pending", "expired", "failed"],
    });
    if (!ok) throw new CheckoutBlockedError("payment_in_progress");
  } else {
    const id = newId();
    const inserted = await insertBalancePaymentIfAbsent({
      id,
      participantId: participant.id,
      kind: "balance",
      amountCents: owed,
      currency: "PLN",
      status: "pending",
      dueAt: event.balanceDueAt ?? null,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      stripeApplicationFee: null,
      lastReminderAt: null,
      paidAt: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    // A concurrent call created the row first; let the user retry.
    if (!inserted) throw new CheckoutBlockedError("payment_in_progress");
    row = { id } as Payment;
  }

  const token = await signParticipantToken(participant.id, getParticipantAuthSecret());
  const tripUrl = `${origin}/my-trips/${participant.id}?t=${encodeURIComponent(token)}`;

  try {
    const session = await createCheckoutSession({
      stripeAccountId: accountId,
      customerEmail: participant.email,
      amountCents: owed,
      productName: `Dopłata: ${event.title}`,
      paymentId: row.id,
      participantId: participant.id,
      successUrl: tripUrl,
      cancelUrl: tripUrl,
      expiresAtMs: expiresAt,
    });
    await setPaymentStripeSession(row.id, session.id);
    return session.url;
  } catch (err) {
    await markPaymentFailedIfPending(row.id, null).catch(() => {});
    throw err;
  }
}

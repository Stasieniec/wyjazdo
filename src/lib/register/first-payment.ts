import type { Event, Organizer, Participant, Payment } from "@/lib/db/schema";
import {
  listPaymentsForParticipant,
  markPaymentFailedIfPending,
  reopenFirstPaymentIfRoom,
  reopenPayment,
  setPaymentStripeSession,
} from "@/lib/db/queries/payments";
import { isLivePending } from "@/lib/participant-status";
import { planFirstPayment, PaymentRuleError } from "@/lib/payment-plan";
import { computeRegistrationAmountsCents } from "./compute-registration-amounts";
import {
  closeCheckoutSession,
  createCheckoutSession,
  getCheckoutSessionState,
} from "@/lib/stripe-checkout";

export const FIRST_PAYMENT_TTL_MS = 30 * 60 * 1000;

/** Reasons a first payment cannot be (re)opened, shown to the user. */
export class CheckoutBlockedError extends Error {
  constructor(
    readonly reason:
      | "not_active"
      | "already_paid"
      | "payment_in_progress"
      | "no_place"
      | "nothing_to_pay"
      | "below_minimum",
  ) {
    super(reason);
  }
}

export function firstPaymentProductName(kind: "full" | "deposit", eventTitle: string): string {
  return kind === "deposit" ? `Zaliczka: ${eventTitle}` : eventTitle;
}

function latestFirstPayment(payments: Payment[]): Payment | undefined {
  return payments
    .filter((p) => p.kind === "full" || p.kind === "deposit")
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

/**
 * Gives a participant who has not paid yet a working checkout link.
 *
 * - If their checkout is still payable: with reuseOpen, the open session is
 *   returned as is (participant clicking "pay" twice). Otherwise the old
 *   session is expired first and a fresh one created (organizer resending).
 * - If their checkout lapsed, they no longer hold a place, so re-opening it
 *   goes through the same capacity check as a new registration.
 * - If the old session was already paid and the webhook has not landed yet,
 *   no new session is created (that would be a double charge).
 */
export async function openFirstPaymentCheckout(params: {
  participant: Participant;
  event: Event;
  organizer: Organizer;
  successUrl: string;
  cancelUrl: string;
  reuseOpen: boolean;
  nowMs?: number;
}): Promise<string> {
  const { participant, event, organizer } = params;
  const now = params.nowMs ?? Date.now();
  if (!organizer.stripeAccountId) throw new Error("organizer not connected");
  if (participant.lifecycleStatus !== "active") throw new CheckoutBlockedError("not_active");

  const payments = await listPaymentsForParticipant(participant.id);
  if (payments.some((p) => p.status === "succeeded" || p.status === "refunded")) {
    throw new CheckoutBlockedError("already_paid");
  }
  const target = latestFirstPayment(payments);
  if (!target) throw new CheckoutBlockedError("nothing_to_pay");

  const accountId = organizer.stripeAccountId;
  const live = isLivePending(target, now);

  if (target.stripeSessionId) {
    const state = await getCheckoutSessionState(accountId, target.stripeSessionId);
    if (state.state === "complete") throw new CheckoutBlockedError("payment_in_progress");
    if (state.state === "open" && live && params.reuseOpen) return state.url;
    if (state.state === "open") {
      const closed = await closeCheckoutSession(accountId, target.stripeSessionId);
      if (closed === "complete") throw new CheckoutBlockedError("payment_in_progress");
    }
  }

  const amounts = await computeRegistrationAmountsCents(participant.id, event);
  let plan;
  try {
    plan = planFirstPayment({
      totalCents: amounts.totalCents,
      depositPerPersonCents: event.depositCents,
      attendeeCount: amounts.attendeeCount,
      balanceDueAt: event.balanceDueAt,
      nowMs: now,
    });
  } catch (err) {
    if (err instanceof PaymentRuleError) throw new CheckoutBlockedError("below_minimum");
    throw err;
  }
  if (plan.kind === "free") throw new CheckoutBlockedError("nothing_to_pay");

  const expiresAt = now + FIRST_PAYMENT_TTL_MS;
  const reopened = live
    ? await reopenPayment({
        paymentId: target.id,
        kind: plan.kind,
        amountCents: plan.amountCents,
        expiresAt,
        allowedStatuses: ["pending"],
      })
    : await reopenFirstPaymentIfRoom({
        paymentId: target.id,
        participantId: participant.id,
        eventId: event.id,
        capacity: event.capacity,
        kind: plan.kind,
        amountCents: plan.amountCents,
        expiresAt,
        nowMs: now,
      });
  if (!reopened) throw new CheckoutBlockedError(live ? "payment_in_progress" : "no_place");

  try {
    const session = await createCheckoutSession({
      stripeAccountId: accountId,
      customerEmail: participant.email,
      amountCents: plan.amountCents,
      productName: firstPaymentProductName(plan.kind, event.title),
      paymentId: target.id,
      participantId: participant.id,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      expiresAtMs: expiresAt,
    });
    await setPaymentStripeSession(target.id, session.id);
    return session.url;
  } catch (err) {
    // No session exists for the re-opened row: release the place again.
    await markPaymentFailedIfPending(target.id, null).catch(() => {});
    throw err;
  }
}

/** Polish message for a CheckoutBlockedError, for participant and organizer screens. */
export function checkoutBlockedMessage(reason: CheckoutBlockedError["reason"]): string {
  switch (reason) {
    case "not_active":
      return "To zgłoszenie nie jest aktywne.";
    case "already_paid":
      return "Ta rezerwacja jest już opłacona.";
    case "payment_in_progress":
      return "Płatność jest w trakcie przetwarzania. Odśwież stronę za chwilę.";
    case "no_place":
      return "Niestety nie ma już wolnych miejsc.";
    case "nothing_to_pay":
      return "Brak kwoty do zapłaty.";
    case "below_minimum":
      return "Kwota jest niższa niż minimalna kwota płatności (2 zł).";
  }
}

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  getPaymentById,
  markPaymentSucceeded,
  expirePendingPaymentsForParticipant,
  listPaymentsForParticipant,
} from "@/lib/db/queries/payments";
import {
  cancelParticipant,
  getParticipantWithContext,
  setParticipantAttention,
} from "@/lib/db/queries/participants";
import type { Organizer, Participant } from "@/lib/db/schema";
import { countTakenSpots } from "@/lib/capacity";
import {
  sendOrganizerAttention,
  sendOrganizerNewRegistration,
  sendPaymentConfirmation,
} from "@/lib/email/send";
import type { AttentionReason } from "@/lib/email/templates";
import { dashboardEventParticipantsUrl, participantTripUrl, publicEventUrl } from "@/lib/urls";
import { getParticipantAuthSecret, signParticipantToken } from "@/lib/participant-auth";
import { formatWarsawDate } from "@/lib/timezone";
import { closeCheckoutSession } from "@/lib/stripe-checkout";

/**
 * What happens when money arrives. Provider independent: called by the Stripe
 * webhook today, would be called by any other provider's notification.
 *
 * - The payment is recorded as succeeded even if it had been marked failed or
 *   expired (money taken must never be lost).
 * - A cancelled participant stays cancelled; the organizer is told.
 * - A participant whose hold had lapsed takes their place again. If that
 *   overbooks the event the payment is still recorded and the organizer is
 *   told.
 * - A second payment for a row that is already paid is flagged.
 *
 * Returns true when the payment row transitioned (emails were sent).
 */
export async function recordPaymentSuccess(params: {
  paymentId: string;
  providerPaymentId: string;
  amountCents: number;
  paidAt: number;
}): Promise<boolean> {
  const transitioned = await markPaymentSucceeded({
    paymentId: params.paymentId,
    stripePaymentIntentId: params.providerPaymentId,
    amountCents: params.amountCents,
    applicationFeeCents: null,
    paidAt: params.paidAt,
  });

  const payment = await getPaymentById(params.paymentId);
  if (!payment) return transitioned;
  const ctx = await getParticipantWithContext(payment.participantId);
  if (!ctx) return transitioned;

  if (!transitioned) {
    const isSecondCharge =
      (payment.status === "succeeded" || payment.status === "refunded") &&
      !!params.providerPaymentId &&
      !!payment.stripePaymentIntentId &&
      payment.stripePaymentIntentId !== params.providerPaymentId;
    if (isSecondCharge) {
      console.error("[payments] second charge for an already paid row", {
        paymentId: payment.id,
        recorded: payment.stripePaymentIntentId,
        incoming: params.providerPaymentId,
      });
      await flag(ctx, "duplicate_payment", params.amountCents, params.paidAt);
    }
    return false;
  }

  if (ctx.participant.lifecycleStatus === "cancelled") {
    await flag(ctx, "paid_while_cancelled", payment.amountCents, params.paidAt);
    return true;
  }

  if (ctx.participant.lifecycleStatus === "waitlisted") {
    // Only reachable through a race with an undone promotion. They paid, so
    // they are in; the overbooking check below catches a full event.
    const db = getDb();
    await db
      .update(schema.participants)
      .set({ lifecycleStatus: "active", updatedAt: Date.now() })
      .where(eq(schema.participants.id, ctx.participant.id));
  }

  const taken = await countTakenSpots(ctx.event.id, Date.now());
  if (taken > ctx.event.capacity) {
    await flag(ctx, "overbooked", payment.amountCents, params.paidAt);
  }

  const token = await signParticipantToken(payment.participantId, getParticipantAuthSecret());
  const myTripsUrl = `${participantTripUrl(payment.participantId)}?t=${encodeURIComponent(token)}`;
  const emails: Promise<void>[] = [
    sendPaymentConfirmation({
      to: ctx.participant.email,
      participantName: ctx.participant.firstName,
      eventTitle: ctx.event.title,
      eventDate: formatWarsawDate(ctx.event.startsAt),
      eventLocation: ctx.event.location,
      eventUrl: publicEventUrl(ctx.organizer.subdomain, ctx.event.slug),
      organizerName: ctx.organizer.displayName,
      paymentKind: payment.kind,
      amountCents: payment.amountCents,
      myTripsUrl,
      replyTo: ctx.organizer.contactEmail,
    }),
  ];
  if (ctx.organizer.contactEmail) {
    emails.push(
      sendOrganizerNewRegistration({
        to: ctx.organizer.contactEmail,
        participantName: `${ctx.participant.firstName} ${ctx.participant.lastName}`,
        participantEmail: ctx.participant.email,
        eventTitle: ctx.event.title,
        spotsInfo: `${taken} / ${ctx.event.capacity}`,
        isWaitlisted: false,
        dashboardUrl: dashboardEventParticipantsUrl(ctx.event.id),
      }),
    );
  }
  await Promise.allSettled(emails);
  return true;
}

async function flag(
  ctx: { participant: Participant; event: { id: string; title: string }; organizer: Organizer },
  reason: AttentionReason,
  amountCents: number,
  nowMs: number,
) {
  await setParticipantAttention(ctx.participant.id, reason, nowMs);
  if (!ctx.organizer.contactEmail) return;
  await sendOrganizerAttention({
    to: ctx.organizer.contactEmail,
    reason,
    participantName: `${ctx.participant.firstName} ${ctx.participant.lastName}`,
    participantEmail: ctx.participant.email,
    eventTitle: ctx.event.title,
    amountCents,
    dashboardUrl: dashboardEventParticipantsUrl(ctx.event.id),
  });
}

/**
 * Cancels a registration: the participant stops holding a place and any
 * checkout they could still pay is closed, so they cannot pay into a
 * cancelled booking. If a session turns out to be already paid, the webhook
 * will record it and flag it for the organizer.
 */
export async function cancelRegistration(params: {
  participantId: string;
  stripeAccountId: string | null;
}): Promise<void> {
  await cancelParticipant(params.participantId);
  const payments = await listPaymentsForParticipant(params.participantId);
  for (const p of payments) {
    if (p.status !== "pending" || !p.stripeSessionId || !params.stripeAccountId) continue;
    try {
      await closeCheckoutSession(params.stripeAccountId, p.stripeSessionId);
    } catch (err) {
      console.error("[cancel] could not expire checkout session", p.stripeSessionId, err);
    }
  }
  await expirePendingPaymentsForParticipant(params.participantId);
}

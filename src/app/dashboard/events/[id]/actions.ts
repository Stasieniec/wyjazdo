"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer, updateEvent } from "@/lib/db/queries/events-dashboard";
import { getEventById } from "@/lib/db/queries/events";
import { getPaymentById, setBalanceDueAtForPayment, setPaymentStripeSession, listPaymentsForParticipant } from "@/lib/db/queries/payments";
import {
  getParticipantById,
  promoteWaitlistedParticipant,
  revertPromotion,
  clearParticipantAttention,
} from "@/lib/db/queries/participants";
import { softCancelAttendee, listActiveAttendeesForParticipant } from "@/lib/db/queries/attendees";
import { countTakenSpots } from "@/lib/capacity";
import { newId } from "@/lib/ids";
import { createCheckoutSession } from "@/lib/stripe-checkout";
import { planFirstPayment, PaymentRuleError } from "@/lib/payment-plan";
import {
  openFirstPaymentCheckout,
  firstPaymentProductName,
  CheckoutBlockedError,
  checkoutBlockedMessage,
} from "@/lib/register/first-payment";
import { cancelRegistration } from "@/lib/register/payment-outcomes";
import { runAfterResponse } from "@/lib/background";
import { parseFormDateTime, formatWarsawDate, formatWarsawDateTime } from "@/lib/timezone";
import {
  sendWaitlistPromoted,
  sendResendPaymentLink,
  sendPaymentConfirmation,
  sendOrganizerNewRegistration,
} from "@/lib/email/send";
import { publicEventUrl, participantTripUrl, dashboardEventParticipantsUrl } from "@/lib/urls";
import { computeRegistrationAmountsCents } from "@/lib/register/compute-registration-amounts";
import {
  signParticipantToken,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";

const statusSchema = z.enum(["draft", "published", "archived"]);

export async function changeStatusAction(eventId: string, status: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) throw new Error("Invalid status");
  if (parsed.data === "published") {
    if (organizer.stripeOnboardingComplete !== 1 || organizer.stripePayoutsEnabled !== 1) {
      throw new Error("Publikacja wymaga ukończenia konfiguracji Stripe.");
    }
  }
  const ev = await getEventForOrganizer(organizer.id, eventId);
  if (!ev) throw new Error("Not found");
  const patch: Partial<typeof ev> = {
    status: parsed.data,
    ...(parsed.data === "published" && ev.publishedAt == null
      ? { publishedAt: Date.now() }
      : {}),
  };
  await updateEvent(organizer.id, eventId, patch);
  revalidatePath(`/dashboard/events/${eventId}`);
}

export async function extendBalanceDeadlineAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");

  const paymentId = String(form.get("paymentId") ?? "");
  const newDueStr = String(form.get("dueAt") ?? "");
  if (!paymentId || !newDueStr) throw new Error("missing fields");
  const newDue = parseFormDateTime(newDueStr);
  if (!Number.isFinite(newDue) || newDue <= Date.now()) throw new Error("invalid date");

  const payment = await getPaymentById(paymentId);
  if (!payment || payment.kind !== "balance") throw new Error("invalid payment");
  const participant = await getParticipantById(payment.participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");

  await setBalanceDueAtForPayment(paymentId, newDue);
  revalidatePath(`/dashboard/events/${event.id}`);
}

export async function cancelParticipantAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");

  const participantId = String(form.get("participantId") ?? "");
  const participant = await getParticipantById(participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");

  await cancelRegistration({ participantId, stripeAccountId: organizer.stripeAccountId });
  revalidatePath(`/dashboard/events/${event.id}`);
}

/** Organizer has dealt with a flagged participant (overbooking, payment after cancel). */
export async function acknowledgeAttentionAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");
  const participantId = String(form.get("participantId") ?? "");
  const participant = await getParticipantById(participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");
  await clearParticipantAttention(participantId);
  revalidatePath(`/dashboard/events/${event.id}`);
}

export async function removeAttendeeAction(formData: FormData): Promise<{ error?: string }> {
  const attendeeId = String(formData.get("attendeeId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  if (!attendeeId || !participantId) return { error: "Brak danych." };

  const { userId } = await auth();
  if (!userId) return { error: "Brak uprawnień." };
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) return { error: "Brak uprawnień." };

  const participant = await getParticipantById(participantId);
  if (!participant) return { error: "Nie znaleziono uczestnika." };
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) return { error: "Brak uprawnień." };

  const active = await listActiveAttendeesForParticipant(participantId);
  if (active.length <= 1) return { error: "Nie można usunąć ostatniego uczestnika — anuluj całe zgłoszenie." };
  if (!active.some((a) => a.id === attendeeId)) return { error: "Uczestnik nie należy do tego zgłoszenia." };

  await softCancelAttendee(attendeeId, Date.now());
  revalidatePath(`/dashboard/events/${event.id}`);
  return {};
}

export async function promoteFromWaitlistAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");
  if (!organizer.stripeAccountId) throw new Error("stripe not connected");

  const participantId = String(form.get("participantId") ?? "");
  const expiresAtStr = String(form.get("expiresAt") ?? "");
  if (!participantId || !expiresAtStr) throw new Error("missing fields");

  const expiresAtMs = parseFormDateTime(expiresAtStr);
  const MAX_STRIPE_EXPIRY_MS = 24 * 60 * 60 * 1000;
  const MIN_STRIPE_EXPIRY_MS = 30 * 60 * 1000;
  const now = Date.now();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
    throw new Error("invalid expiry date");
  }
  if (expiresAtMs > now + MAX_STRIPE_EXPIRY_MS) {
    throw new Error("expiry too far in the future (max 24h)");
  }
  if (expiresAtMs < now + MIN_STRIPE_EXPIRY_MS) {
    throw new Error("expiry too soon (min 30 minutes)");
  }

  const participant = await getParticipantById(participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");
  if (participant.lifecycleStatus !== "waitlisted") throw new Error("not waitlisted");
  const stripeAccountId = organizer.stripeAccountId;

  // What they will pay, decided before taking the place.
  const amounts = await computeRegistrationAmountsCents(participantId, event);
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
    if (err instanceof PaymentRuleError) throw new Error("amount below minimum charge (2 zł)");
    throw err;
  }
  const isFree = plan.kind === "free";
  const paymentId = newId();

  // Capacity check (whole party), activation and the payment row in one batch.
  const promoted = await promoteWaitlistedParticipant({
    participantId,
    eventId: event.id,
    capacity: event.capacity,
    nowMs: now,
    payment: {
      id: paymentId,
      participantId,
      kind: plan.kind === "free" ? "full" : plan.kind,
      amountCents: plan.amountCents,
      currency: "PLN",
      status: isFree ? "succeeded" : "pending",
      dueAt: null,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      stripeApplicationFee: null,
      lastReminderAt: null,
      paidAt: isFree ? now : null,
      expiresAt: isFree ? null : expiresAtMs,
      createdAt: now,
      updatedAt: now,
    },
  });
  if (!promoted) throw new Error("no capacity");

  const eventDate = formatWarsawDate(event.startsAt);
  const replyTo = organizer.contactEmail;

  if (plan.kind === "free") {
    runAfterResponse("promotion emails (free)", async () => {
      const token = await signParticipantToken(participantId, getParticipantAuthSecret());
      const myTripsUrl = `${participantTripUrl(participantId)}?t=${encodeURIComponent(token)}`;
      const emails: Promise<void>[] = [
        sendPaymentConfirmation({
          to: participant.email,
          participantName: participant.firstName,
          eventTitle: event.title,
          eventDate,
          eventLocation: event.location,
          eventUrl: publicEventUrl(organizer.subdomain, event.slug),
          organizerName: organizer.displayName,
          paymentKind: "full",
          amountCents: 0,
          myTripsUrl,
          replyTo,
        }),
      ];
      if (organizer.contactEmail) {
        const takenAfter = await countTakenSpots(event.id, Date.now());
        emails.push(
          sendOrganizerNewRegistration({
            to: organizer.contactEmail,
            participantName: `${participant.firstName} ${participant.lastName}`,
            participantEmail: participant.email,
            eventTitle: event.title,
            spotsInfo: `${takenAfter} / ${event.capacity}`,
            isWaitlisted: false,
            dashboardUrl: dashboardEventParticipantsUrl(event.id),
          }),
        );
      }
      await Promise.allSettled(emails);
    });
    revalidatePath(`/dashboard/events/${event.id}`);
    return;
  }

  const eventUrl = publicEventUrl(organizer.subdomain, event.slug);
  let sessionUrl: string;
  try {
    const session = await createCheckoutSession({
      stripeAccountId,
      customerEmail: participant.email,
      amountCents: plan.amountCents,
      productName: firstPaymentProductName(plan.kind, event.title),
      paymentId,
      participantId,
      successUrl: `${eventUrl}/thanks?pid=${participantId}`,
      cancelUrl: eventUrl,
      expiresAtMs,
    });
    await setPaymentStripeSession(paymentId, session.id);
    sessionUrl = session.url;
  } catch (err) {
    // Without a checkout the promotion is undone: back to the waitlist.
    await revertPromotion(participantId, paymentId);
    throw err;
  }

  const expiryDate = formatWarsawDateTime(expiresAtMs);
  runAfterResponse("waitlist promoted email", () =>
    sendWaitlistPromoted({
      to: participant.email,
      participantName: participant.firstName,
      eventTitle: event.title,
      paymentUrl: sessionUrl,
      expiryDate,
      eventDate,
      eventLocation: event.location,
      organizerName: organizer.displayName,
      replyTo,
    }),
  );

  revalidatePath(`/dashboard/events/${event.id}`);
}


export async function resendPaymentLinkAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");
  if (!organizer.stripeAccountId) throw new Error("stripe not connected");

  const participantId = String(form.get("participantId") ?? "");
  if (!participantId) throw new Error("missing participantId");

  const participant = await getParticipantById(participantId);
  if (!participant) throw new Error("no participant");
  if (participant.lifecycleStatus !== "active") throw new Error("participant not active");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");

  const eventUrl = publicEventUrl(organizer.subdomain, event.slug);
  let url: string;
  try {
    // Expires the old session first (no two payable links for one row) and
    // refuses if the old one was already paid. A lapsed hold only comes back
    // if the party still fits.
    url = await openFirstPaymentCheckout({
      participant,
      event,
      organizer,
      successUrl: `${eventUrl}/thanks?pid=${participantId}`,
      cancelUrl: eventUrl,
      reuseOpen: false,
    });
  } catch (err) {
    if (err instanceof CheckoutBlockedError) throw new Error(checkoutBlockedMessage(err.reason));
    throw err;
  }

  runAfterResponse("resend payment link email", () =>
    sendResendPaymentLink({
      to: participant.email,
      participantName: participant.firstName,
      eventTitle: event.title,
      paymentUrl: url,
      organizerName: organizer.displayName,
      replyTo: organizer.contactEmail,
    }),
  );

  revalidatePath(`/dashboard/events/${event.id}`);
}

/**
 * Re-sends the payment confirmation email for a participant whose latest
 * succeeded payment never got its original confirmation (e.g. Resend was
 * down at the moment of the Stripe webhook). Organizer-triggered recovery
 * path — the webhook is still the primary send.
 */
export async function resendPaymentConfirmationAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("no organizer");

  const participantId = String(form.get("participantId") ?? "");
  if (!participantId) throw new Error("missing participantId");

  const participant = await getParticipantById(participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");

  const payments = await listPaymentsForParticipant(participantId);
  const succeeded = payments.filter((p) => p.status === "succeeded");
  if (succeeded.length === 0) throw new Error("no succeeded payment");
  // Prefer the most-recently-paid one.
  const target = succeeded.reduce((a, b) => ((a.paidAt ?? 0) > (b.paidAt ?? 0) ? a : b));

  const dateStr = formatWarsawDate(event.startsAt);
  const secret = getParticipantAuthSecret();
  const token = await signParticipantToken(participantId, secret);
  const myTripsUrl = `${participantTripUrl(participantId)}?t=${encodeURIComponent(token)}`;

  await sendPaymentConfirmation({
    to: participant.email,
    participantName: participant.firstName,
    eventTitle: event.title,
    eventDate: dateStr,
    eventLocation: event.location,
    eventUrl: publicEventUrl(organizer.subdomain, event.slug),
    organizerName: organizer.displayName,
    paymentKind: target.kind,
    amountCents: target.amountCents,
    myTripsUrl,
    replyTo: organizer.contactEmail,
  });

  revalidatePath(`/dashboard/events/${event.id}`);
}

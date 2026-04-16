"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eventBaseSchema, customQuestionSchema } from "@/lib/validators/event";
import { consentConfigSchema } from "@/lib/validators/consent";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer, updateEvent } from "@/lib/db/queries/events-dashboard";
import { getEventById } from "@/lib/db/queries/events";
import { getPaymentById, setBalanceDueAtForPayment, insertPayment, setPaymentStripeSession, listPaymentsForParticipant, resetPaymentToPending } from "@/lib/db/queries/payments";
import { getParticipantById, cancelParticipant, activateWaitlistedParticipant } from "@/lib/db/queries/participants";
import { zodIssuesToRecord } from "@/lib/zod-errors";
import { countTakenSpots } from "@/lib/capacity";
import { getStripe } from "@/lib/stripe";
import { newId } from "@/lib/ids";
import { sendWaitlistPromoted, sendResendPaymentLink } from "@/lib/email/send";
import { publicEventUrl } from "@/lib/urls";

export type SaveEventFormState = { errors?: Record<string, string> } | null;

export async function saveEventAction(
  eventId: string,
  _prev: SaveEventFormState,
  formData: FormData,
): Promise<SaveEventFormState> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) throw new Error("No organizer");
  const existing = await getEventForOrganizer(organizer.id, eventId);
  if (!existing) throw new Error("Not found");

  let questionsParsed;
  try {
    const questionsRaw = String(formData.get("customQuestions") ?? "[]");
    questionsParsed = z.array(customQuestionSchema).safeParse(JSON.parse(questionsRaw));
  } catch {
    return { errors: { customQuestions: "Nieprawidłowy format listy pytań." } };
  }
  if (!questionsParsed.success) {
    return {
      errors: {
        customQuestions:
          questionsParsed.error.issues[0]?.message ?? "Błąd walidacji pytań niestandardowych.",
      },
    };
  }

  let consentsParsed;
  try {
    const consentsRaw = String(formData.get("consentConfig") ?? "[]");
    consentsParsed = consentConfigSchema.safeParse(JSON.parse(consentsRaw));
  } catch {
    return { errors: { consentConfig: "Nieprawidłowy format listy zgód." } };
  }
  if (!consentsParsed.success) {
    return {
      errors: {
        consentConfig:
          consentsParsed.error.issues[0]?.message ?? "Błąd walidacji zgód.",
      },
    };
  }

  const depositRaw = formData.get("deposit") as string;
  const balanceDueAtRaw = formData.get("balanceDueAt") as string;
  const depositCents =
    depositRaw && depositRaw.trim() !== ""
      ? Math.round(Number(depositRaw) * 100)
      : null;
  const balanceDueAt =
    balanceDueAtRaw && balanceDueAtRaw.trim() !== ""
      ? new Date(balanceDueAtRaw).getTime()
      : null;

  const raw = {
    slug: existing.slug,
    title: String(formData.get("title") ?? ""),
    description: (formData.get("description") as string) || undefined,
    location: (formData.get("location") as string) || undefined,
    startsAt: new Date(String(formData.get("startsAt") ?? "")).getTime(),
    endsAt: new Date(String(formData.get("endsAt") ?? "")).getTime(),
    priceCents: Math.round(Number(formData.get("price") ?? 0) * 100),
    currency: "PLN" as const,
    capacity: Number(formData.get("capacity") ?? 0),
    coverUrl: (formData.get("coverUrl") as string) || undefined,
    customQuestions: questionsParsed.data,
    consentConfig: consentsParsed.data,
    depositCents,
    balanceDueAt,
  };
  const parsed = eventBaseSchema.safeParse(raw);
  if (!parsed.success) {
    const err = zodIssuesToRecord(parsed.error.issues);
    if (err.priceCents) {
      err.price = err.priceCents;
      delete err.priceCents;
    }
    return { errors: err };
  }
  if (parsed.data.endsAt < parsed.data.startsAt) {
    return {
      errors: {
        startsAt: "Koniec wydarzenia musi być po jego początku.",
        endsAt: "Koniec wydarzenia musi być po jego początku.",
      },
    };
  }

  await updateEvent(organizer.id, eventId, {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    location: parsed.data.location ?? null,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    priceCents: parsed.data.priceCents,
    capacity: parsed.data.capacity,
    coverUrl: parsed.data.coverUrl || null,
    customQuestions: JSON.stringify(parsed.data.customQuestions),
    consentConfig: JSON.stringify(parsed.data.consentConfig),
    depositCents: parsed.data.depositCents ?? null,
    balanceDueAt: parsed.data.balanceDueAt ?? null,
  });

  revalidatePath(`/dashboard/events/${eventId}`);
  return {};
}

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
  await updateEvent(organizer.id, eventId, { status: parsed.data });
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
  const newDue = new Date(newDueStr).getTime();
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

  await cancelParticipant(participantId);
  revalidatePath(`/dashboard/events/${event.id}`);
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

  const expiresAtMs = new Date(expiresAtStr).getTime();
  const MAX_STRIPE_EXPIRY_MS = 24 * 60 * 60 * 1000;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error("invalid expiry date");
  }
  if (expiresAtMs > Date.now() + MAX_STRIPE_EXPIRY_MS) {
    throw new Error("expiry too far in the future (max 24h)");
  }

  const participant = await getParticipantById(participantId);
  if (!participant) throw new Error("no participant");
  const event = await getEventById(participant.eventId);
  if (!event || event.organizerId !== organizer.id) throw new Error("forbidden");
  if (participant.lifecycleStatus !== "waitlisted") throw new Error("not waitlisted");

  // Capacity check
  const taken = await countTakenSpots(event.id, Date.now());
  if (taken >= event.capacity) throw new Error("no capacity");

  const activated = await activateWaitlistedParticipant(participantId);
  if (!activated) throw new Error("activation failed");

  // Create payment
  const now = Date.now();
  const depositMode =
    event.depositCents != null &&
    event.depositCents > 0 &&
    event.depositCents < event.priceCents;
  const paymentId = newId();
  const paymentKind: "deposit" | "full" = depositMode ? "deposit" : "full";
  const paymentAmount = depositMode ? event.depositCents! : event.priceCents;

  await insertPayment({
    id: paymentId,
    participantId,
    kind: paymentKind,
    amountCents: paymentAmount,
    currency: "PLN",
    status: "pending",
    dueAt: null,
    stripeSessionId: null,
    stripePaymentIntentId: null,
    stripeApplicationFee: null,
    lastReminderAt: null,
    paidAt: null,
    expiresAt: expiresAtMs,
    createdAt: now,
    updatedAt: now,
  });

  const stripe = getStripe();
  const eventUrl = publicEventUrl(organizer.subdomain, event.slug);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: participant.email,
      line_items: [
        {
          price_data: {
            currency: "pln",
            unit_amount: paymentAmount,
            product_data: {
              name: depositMode ? `Zaliczka — ${event.title}` : event.title,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { payment_id: paymentId, participant_id: participantId },
      payment_intent_data: {
        application_fee_amount: 0,
        metadata: { payment_id: paymentId, participant_id: participantId },
      },
      success_url: `${eventUrl}/thanks?pid=${participantId}`,
      cancel_url: eventUrl,
      expires_at: Math.floor(expiresAtMs / 1000),
    },
    { stripeAccount: organizer.stripeAccountId },
  );

  await setPaymentStripeSession(paymentId, session.id);

  // Send email (fire-and-forget)
  const eventDate = new Date(event.startsAt).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const expiryDate = new Date(expiresAtMs).toLocaleString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  sendWaitlistPromoted({
    to: participant.email,
    participantName: participant.firstName,
    eventTitle: event.title,
    paymentUrl: session.url!,
    expiryDate,
    eventDate,
    eventLocation: event.location,
    organizerName: organizer.displayName,
  }).catch(() => {});

  revalidatePath(`/dashboard/events/${event.id}`);
}

const PENDING_TTL_MS = 30 * 60 * 1000;

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

  const payments = await listPaymentsForParticipant(participantId);
  // Find the payment that needs a fresh session: pending or expired, not succeeded
  const target = payments.find(
    (p) => (p.status === "pending" || p.status === "expired") && p.kind !== "balance",
  ) ?? payments.find(
    (p) => (p.status === "pending" || p.status === "expired"),
  );

  if (!target) throw new Error("no payment to resend");

  const now = Date.now();
  const expiresAt = now + PENDING_TTL_MS;

  // Reset expired payment back to pending
  if (target.status === "expired") {
    const reset = await resetPaymentToPending(target.id, expiresAt);
    if (!reset) throw new Error("payment status changed concurrently");
  }

  const stripe = getStripe();
  const eventUrl = publicEventUrl(organizer.subdomain, event.slug);
  const depositMode = target.kind === "deposit";

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: participant.email,
      line_items: [
        {
          price_data: {
            currency: "pln",
            unit_amount: target.amountCents,
            product_data: {
              name: depositMode ? `Zaliczka — ${event.title}` : event.title,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { payment_id: target.id, participant_id: participantId },
      payment_intent_data: {
        application_fee_amount: 0,
        metadata: { payment_id: target.id, participant_id: participantId },
      },
      success_url: `${eventUrl}/thanks?pid=${participantId}`,
      cancel_url: eventUrl,
      expires_at: Math.floor(expiresAt / 1000),
    },
    { stripeAccount: organizer.stripeAccountId },
  );

  await setPaymentStripeSession(target.id, session.id);

  // Send email (fire-and-forget)
  sendResendPaymentLink({
    to: participant.email,
    participantName: participant.firstName,
    eventTitle: event.title,
    paymentUrl: session.url!,
    organizerName: organizer.displayName,
  }).catch(() => {});

  revalidatePath(`/dashboard/events/${event.id}`);
}

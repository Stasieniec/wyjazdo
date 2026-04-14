import { headers } from "next/headers";
import { registrationBaseSchema } from "@/lib/validators/registration";
import type { CustomQuestion } from "@/lib/validators/event";
import { zodIssuesToRecord } from "@/lib/zod-errors";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";
import {
  insertParticipant,
  setStripeSessionId,
} from "@/lib/db/queries/participants";
import { newId } from "@/lib/ids";
import { getStripe } from "@/lib/stripe";
import {
  sendWaitlistConfirmation,
  sendOrganizerNewRegistration,
} from "@/lib/email/send";

const PENDING_TTL_MS = 30 * 60 * 1000;

export type RegistrationProcessResult =
  | { redirectUrl: string }
  | { errors: Record<string, string> };

/** Same host pattern as POST /api/register: `{proto}//{subdomain}.{NEXT_PUBLIC_ROOT_DOMAIN}`. */
async function eventSiteOrigin(subdomain: string, requestProtocol?: string) {
  const rootHost = subdomain + "." + (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000");
  let proto = requestProtocol;
  if (!proto) {
    const h = await headers();
    const p = h.get("x-forwarded-proto") ?? "http";
    proto = p.endsWith(":") ? p : `${p}:`;
  }
  return `${proto}//${rootHost}`;
}

export async function processRegistration(
  form: FormData,
  requestProtocol?: string,
): Promise<RegistrationProcessResult> {
  const parsed = registrationBaseSchema.safeParse({
    eventId: form.get("eventId"),
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    email: form.get("email"),
    phone: form.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { errors: zodIssuesToRecord(parsed.error.issues) };
  }

  const subdomain = String(form.get("organizerSubdomain") ?? "");
  const slug = String(form.get("eventSlug") ?? "");
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) {
    return { errors: { _form: "Nie znaleziono organizatora." } };
  }
  const event = await getPublishedEventBySlug(organizer.id, slug);
  if (!event || event.id !== parsed.data.eventId) {
    return { errors: { _form: "Nie znaleziono wydarzenia." } };
  }

  const questions: CustomQuestion[] = event.customQuestions
    ? JSON.parse(event.customQuestions)
    : [];

  const errors: Record<string, string> = {};
  for (const q of questions) {
    const v = form.get(`q_${q.id}`);
    if (q.required && (!v || String(v).trim() === "")) {
      errors[`q_${q.id}`] = "To pole jest wymagane.";
    }
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const answers: Record<string, string> = {};
  for (const q of questions) {
    const v = form.get(`q_${q.id}`);
    if (v) answers[q.id] = String(v);
  }

  const now = Date.now();
  const taken = await countTakenSpots(event.id, now);
  const isFull = taken >= event.capacity;

  const participantId = newId();
  const origin = await eventSiteOrigin(subdomain, requestProtocol);

  if (isFull) {
    await insertParticipant({
      id: participantId,
      eventId: event.id,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      customAnswers: JSON.stringify(answers),
      status: "waitlisted",
      expiresAt: null,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      amountPaidCents: null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Fire-and-forget emails — don't block the redirect
    const emailPromises: Promise<void>[] = [
      sendWaitlistConfirmation({
        to: parsed.data.email,
        participantName: parsed.data.firstName,
        eventTitle: event.title,
        eventUrl: `${origin}/${slug}`,
        organizerName: organizer.displayName,
      }),
    ];
    if (organizer.contactEmail) {
      emailPromises.push(
        sendOrganizerNewRegistration({
          to: organizer.contactEmail,
          participantName: `${parsed.data.firstName} ${parsed.data.lastName}`,
          participantEmail: parsed.data.email,
          eventTitle: event.title,
          spotsInfo: `${taken} / ${event.capacity} (pełne)`,
          isWaitlisted: true,
          dashboardUrl: `https://wyjazdo.pl/dashboard/events/${event.id}`,
        }),
      );
    }
    Promise.allSettled(emailPromises).catch(() => {});

    return { redirectUrl: `${origin}/${slug}/thanks?waitlisted=1` };
  }

  await insertParticipant({
    id: participantId,
    eventId: event.id,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    customAnswers: JSON.stringify(answers),
    status: "pending",
    expiresAt: now + PENDING_TTL_MS,
    stripeSessionId: null,
    stripePaymentIntentId: null,
    amountPaidCents: null,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "blik", "p24"],
    customer_email: parsed.data.email,
    line_items: [
      {
        price_data: {
          currency: "pln",
          unit_amount: event.priceCents,
          product_data: { name: event.title },
        },
        quantity: 1,
      },
    ],
    metadata: { participant_id: participantId },
    payment_intent_data: {
      metadata: { participant_id: participantId },
    },
    success_url: `${origin}/${slug}/thanks?pid=${participantId}`,
    cancel_url: `${origin}/${slug}/register`,
    expires_at: Math.floor((now + PENDING_TTL_MS) / 1000),
  });

  await setStripeSessionId(participantId, session.id);

  if (!session.url) {
    return { errors: { _form: "Nie udało się utworzyć sesji płatności." } };
  }

  return { redirectUrl: session.url };
}

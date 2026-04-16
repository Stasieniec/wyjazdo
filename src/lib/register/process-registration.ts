import { headers } from "next/headers";
import { registrationBaseSchema } from "@/lib/validators/registration";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import { zodIssuesToRecord } from "@/lib/zod-errors";
import {
  getLatestDocument,
  insertParticipantConsents,
} from "@/lib/db/queries/legal";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";
import { insertParticipant } from "@/lib/db/queries/participants";
import { insertPayment, setPaymentStripeSession } from "@/lib/db/queries/payments";
import { newId } from "@/lib/ids";
import { getStripe } from "@/lib/stripe";
import {
  sendWaitlistConfirmation,
  sendOrganizerNewRegistration,
} from "@/lib/email/send";
import { dashboardEventUrl, participantTripUrl } from "@/lib/urls";
import { signParticipantToken, getParticipantAuthSecret } from "@/lib/participant-auth";

const PENDING_TTL_MS = 30 * 60 * 1000;

export type RegistrationProcessResult =
  | { redirectUrl: string }
  | { errors: Record<string, string> };

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

async function recordParticipantConsents(
  participantId: string,
  form: FormData,
  eventConsents: ConsentConfigItem[],
  ip: string | null,
) {
  const [regulamin, privacyPolicy] = await Promise.all([
    getLatestDocument("regulamin"),
    getLatestDocument("privacy_policy"),
  ]);

  const consentRows: Array<{
    consentKey: string;
    consentLabel: string;
    accepted: boolean;
    documentId: string | null;
  }> = [
    {
      consentKey: "platform_regulamin",
      consentLabel: "Akceptacja Regulaminu serwisu wyjazdo.pl",
      accepted: form.get("consent_regulamin") === "true",
      documentId: regulamin?.id ?? null,
    },
    {
      consentKey: "platform_privacy",
      consentLabel: "Zapoznanie się z Polityką Prywatności",
      accepted: form.get("consent_privacy") === "true",
      documentId: privacyPolicy?.id ?? null,
    },
  ];

  for (const consent of eventConsents) {
    consentRows.push({
      consentKey: `event_${consent.id}`,
      consentLabel: consent.label,
      accepted: form.get(`consent_${consent.id}`) === "true",
      documentId: null,
    });
  }

  await insertParticipantConsents(participantId, consentRows, ip);
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
  if (!parsed.success) return { errors: zodIssuesToRecord(parsed.error.issues) };

  const subdomain = String(form.get("organizerSubdomain") ?? "");
  const slug = String(form.get("eventSlug") ?? "");
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) return { errors: { _form: "Nie znaleziono organizatora." } };

  if (
    !organizer.stripeAccountId ||
    organizer.stripeOnboardingComplete !== 1 ||
    organizer.stripePayoutsEnabled !== 1
  ) {
    return { errors: { _form: "Rejestracja chwilowo niedostępna." } };
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
    if (q.required && (!v || String(v).trim() === ""))
      errors[`q_${q.id}`] = "To pole jest wymagane.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  // ── Consent validation ──
  const consents: ConsentConfigItem[] = event.consentConfig
    ? JSON.parse(event.consentConfig)
    : [];

  // Platform-required consents
  if (form.get("consent_regulamin") !== "true") {
    errors.consent_regulamin = "Akceptacja regulaminu jest wymagana.";
  }
  if (form.get("consent_privacy") !== "true") {
    errors.consent_privacy = "Zapoznanie się z polityką prywatności jest wymagane.";
  }

  // Event-specific required consents
  for (const consent of consents) {
    if (consent.required && form.get(`consent_${consent.id}`) !== "true") {
      errors[`consent_${consent.id}`] = "Ta zgoda jest wymagana.";
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

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
      lifecycleStatus: "waitlisted",
      createdAt: now,
      updatedAt: now,
    });

    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    recordParticipantConsents(participantId, form, consents, ip).catch((err) => {
      console.error("[consent-recording] Failed to record consents for participant", participantId, err);
    });

    const emailPromises: Promise<void>[] = [
      (async () => {
        const secret = getParticipantAuthSecret();
        const token = await signParticipantToken(participantId, secret);
        const myTripsUrl = `${participantTripUrl(participantId)}?t=${encodeURIComponent(token)}`;
        await sendWaitlistConfirmation({
          to: parsed.data.email,
          participantName: parsed.data.firstName,
          eventTitle: event.title,
          eventUrl: `${origin}/${slug}`,
          organizerName: organizer.displayName,
          myTripsUrl,
        });
      })(),
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
          dashboardUrl: dashboardEventUrl(event.id),
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
    lifecycleStatus: "active",
    createdAt: now,
    updatedAt: now,
  });

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  recordParticipantConsents(participantId, form, consents, ip).catch((err) => {
    console.error("[consent-recording] Failed to record consents for participant", participantId, err);
  });

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
    expiresAt: now + PENDING_TTL_MS,
    createdAt: now,
    updatedAt: now,
  });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      customer_email: parsed.data.email,
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
      success_url: `${origin}/${slug}/thanks?pid=${participantId}`,
      cancel_url: `${origin}/${slug}/register`,
      expires_at: Math.floor((now + PENDING_TTL_MS) / 1000),
    },
    { stripeAccount: organizer.stripeAccountId },
  );

  await setPaymentStripeSession(paymentId, session.id);

  if (!session.url) {
    return { errors: { _form: "Nie udało się utworzyć sesji płatności." } };
  }
  return { redirectUrl: session.url };
}

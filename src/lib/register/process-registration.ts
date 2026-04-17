import { headers } from "next/headers";
import { registrationBaseSchema } from "@/lib/validators/registration";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import type { AttendeeFormRow } from "@/lib/validators/attendees-form";
import { attendeesFormSchema } from "@/lib/validators/attendees-form";
import { calculateTotal } from "@/lib/pricing";
import { insertAttendees } from "@/lib/db/queries/attendees";
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

/**
 * Parse attendee rows from FormData. Form convention:
 *   attendees[i][attendeeTypeId]
 *   attendees[i][firstName]
 *   attendees[i][lastName]
 *   attendees[i][field_<customFieldId>]
 */
function parseAttendeesFromForm(
  form: FormData,
  types: AttendeeType[],
): { rows: AttendeeFormRow[]; errors: Record<string, string> } {
  const rowsByIdx = new Map<number, Partial<AttendeeFormRow> & { customAnswers: Record<string, string> }>();
  const errors: Record<string, string> = {};

  for (const [key, value] of form.entries()) {
    const m = key.match(/^attendees\[(\d+)\]\[([^\]]+)\]$/);
    if (!m) continue;
    const idx = Number(m[1]);
    const field = m[2];
    const v = String(value);
    const existing = rowsByIdx.get(idx) ?? { customAnswers: {} };
    if (field === "attendeeTypeId") existing.attendeeTypeId = v;
    else if (field === "firstName") existing.firstName = v;
    else if (field === "lastName") existing.lastName = v;
    else if (field.startsWith("field_")) existing.customAnswers[field.slice("field_".length)] = v;
    rowsByIdx.set(idx, existing);
  }

  const rows = [...rowsByIdx.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, r]) => r as AttendeeFormRow);

  // Validate required per-type custom fields.
  for (const [i, row] of rows.entries()) {
    const type = types.find((t) => t.id === row.attendeeTypeId);
    if (!type) {
      errors[`attendees[${i}]`] = "Nieznany typ uczestnika.";
      continue;
    }
    for (const f of type.customFields ?? []) {
      if (f.required) {
        const val = row.customAnswers?.[f.id];
        if (!val || val.trim() === "") {
          errors[`attendees[${i}][field_${f.id}]`] = "To pole jest wymagane.";
        }
      }
    }
  }

  return { rows, errors };
}

function getAttendeeTypes(event: { attendeeTypes: string | null; priceCents: number }): AttendeeType[] {
  if (event.attendeeTypes) {
    try {
      return JSON.parse(event.attendeeTypes) as AttendeeType[];
    } catch {
      // fall through to legacy path
    }
  }
  // Legacy implicit single type — one attendee, qty 1/1, event price.
  return [
    {
      id: "__legacy__",
      name: "Uczestnik",
      minQty: 1,
      maxQty: 1,
      priceCents: event.priceCents,
    },
  ];
}

function validateAttendeeCountsAgainstTypes(
  rows: AttendeeFormRow[],
  types: AttendeeType[],
): Record<string, string> {
  const errs: Record<string, string> = {};
  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.attendeeTypeId, (byType.get(r.attendeeTypeId) ?? 0) + 1);
  for (const t of types) {
    const qty = byType.get(t.id) ?? 0;
    if (qty < t.minQty) errs[`attendee_type_${t.id}`] = `Wymagana minimalna liczba: ${t.minQty}.`;
    if (qty > t.maxQty) errs[`attendee_type_${t.id}`] = `Przekroczona maksymalna liczba: ${t.maxQty}.`;
  }
  return errs;
}

export async function processRegistration(
  form: FormData,
  requestProtocol?: string,
): Promise<RegistrationProcessResult> {
  const parsedRegistrant = registrationBaseSchema.safeParse({
    eventId: form.get("eventId"),
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    email: form.get("email"),
    phone: form.get("phone") || undefined,
  });
  if (!parsedRegistrant.success) return { errors: zodIssuesToRecord(parsedRegistrant.error.issues) };

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
  if (!event || event.id !== parsedRegistrant.data.eventId) {
    return { errors: { _form: "Nie znaleziono wydarzenia." } };
  }

  const attendeeTypes = getAttendeeTypes(event);
  const isLegacyMode = !event.attendeeTypes;

  let attendeeRows: AttendeeFormRow[];
  if (isLegacyMode) {
    attendeeRows = [
      {
        attendeeTypeId: attendeeTypes[0].id,
        firstName: parsedRegistrant.data.firstName,
        lastName: parsedRegistrant.data.lastName,
        customAnswers: {},
      },
    ];
  } else {
    const parsedAttendees = parseAttendeesFromForm(form, attendeeTypes);
    if (Object.keys(parsedAttendees.errors).length > 0) {
      return { errors: parsedAttendees.errors };
    }
    const zodParsed = attendeesFormSchema.safeParse(parsedAttendees.rows);
    if (!zodParsed.success) {
      return { errors: zodIssuesToRecord(zodParsed.error.issues) };
    }
    const countErrors = validateAttendeeCountsAgainstTypes(zodParsed.data, attendeeTypes);
    if (Object.keys(countErrors).length > 0) return { errors: countErrors };
    attendeeRows = zodParsed.data;
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

  const quantities: Record<string, number> = {};
  for (const r of attendeeRows) {
    quantities[r.attendeeTypeId] = (quantities[r.attendeeTypeId] ?? 0) + 1;
  }
  const totalCents = calculateTotal(attendeeTypes, quantities).total;
  const requestedSpots = attendeeRows.length;

  const now = Date.now();
  const taken = await countTakenSpots(event.id, now);
  const isFull = (taken + requestedSpots) > event.capacity;

  const participantId = newId();
  const origin = await eventSiteOrigin(subdomain, requestProtocol);

  if (isFull) {
    await insertParticipant({
      id: participantId,
      eventId: event.id,
      firstName: parsedRegistrant.data.firstName,
      lastName: parsedRegistrant.data.lastName,
      email: parsedRegistrant.data.email,
      phone: parsedRegistrant.data.phone ?? null,
      customAnswers: JSON.stringify(answers),
      lifecycleStatus: "waitlisted",
      createdAt: now,
      updatedAt: now,
    });

    if (!isLegacyMode) {
      await insertAttendees(
        attendeeRows.map((r) => ({
          id: newId(),
          participantId,
          attendeeTypeId: r.attendeeTypeId,
          firstName: r.firstName,
          lastName: r.lastName,
          customAnswers: JSON.stringify(r.customAnswers ?? {}),
          cancelledAt: null,
          createdAt: now,
        })),
      );
    }

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
          to: parsedRegistrant.data.email,
          participantName: parsedRegistrant.data.firstName,
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
          participantName: `${parsedRegistrant.data.firstName} ${parsedRegistrant.data.lastName}`,
          participantEmail: parsedRegistrant.data.email,
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
    firstName: parsedRegistrant.data.firstName,
    lastName: parsedRegistrant.data.lastName,
    email: parsedRegistrant.data.email,
    phone: parsedRegistrant.data.phone ?? null,
    customAnswers: JSON.stringify(answers),
    lifecycleStatus: "active",
    createdAt: now,
    updatedAt: now,
  });

  if (!isLegacyMode) {
    await insertAttendees(
      attendeeRows.map((r) => ({
        id: newId(),
        participantId,
        attendeeTypeId: r.attendeeTypeId,
        firstName: r.firstName,
        lastName: r.lastName,
        customAnswers: JSON.stringify(r.customAnswers ?? {}),
        cancelledAt: null,
        createdAt: now,
      })),
    );
  }

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  recordParticipantConsents(participantId, form, consents, ip).catch((err) => {
    console.error("[consent-recording] Failed to record consents for participant", participantId, err);
  });

  const depositCents = event.depositCents ?? 0;
  const effectiveDeposit = Math.min(depositCents, totalCents);
  const depositMode = effectiveDeposit > 0 && effectiveDeposit < totalCents;
  const paymentId = newId();
  const paymentKind: "deposit" | "full" = depositMode ? "deposit" : "full";
  const paymentAmount = depositMode ? effectiveDeposit : totalCents;

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
      customer_email: parsedRegistrant.data.email,
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

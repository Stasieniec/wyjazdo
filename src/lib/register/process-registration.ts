import { headers } from "next/headers";
import { registrationBaseSchema } from "@/lib/validators/registration";
import type { CustomQuestion } from "@/lib/validators/event";
import type { ConsentConfigItem } from "@/lib/validators/consent";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import type { AttendeeFormRow } from "@/lib/validators/attendees-form";
import { attendeesFormSchema } from "@/lib/validators/attendees-form";
import { calculateTotal } from "@/lib/pricing";
import type { NewAttendee } from "@/lib/db/schema";
import { zodIssuesToRecord } from "@/lib/zod-errors";
import {
  getLatestDocument,
  insertParticipantConsents,
} from "@/lib/db/queries/legal";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";
import {
  findRecentParticipantForDedupe,
  insertParticipantWithAttendees,
  normalizeEmail,
  registerActiveParticipant,
} from "@/lib/db/queries/participants";
import { markPaymentFailedIfPending, setPaymentStripeSession } from "@/lib/db/queries/payments";
import { newId } from "@/lib/ids";
import { createCheckoutSession } from "@/lib/stripe-checkout";
import { planFirstPayment, PaymentRuleError, type FirstPaymentPlan } from "@/lib/payment-plan";

function tryPlanFirstPayment(params: Parameters<typeof planFirstPayment>[0]): FirstPaymentPlan | null {
  try {
    return planFirstPayment(params);
  } catch (err) {
    if (err instanceof PaymentRuleError) return null;
    throw err;
  }
}
import { firstPaymentProductName } from "./first-payment";
import { runAfterResponse } from "@/lib/background";
import { formatWarsawDate } from "@/lib/timezone";
import type { PriceCalculation } from "@/lib/pricing";
import {
  sendWaitlistConfirmation,
  sendOrganizerNewRegistration,
  sendPaymentConfirmation,
} from "@/lib/email/send";
import { dashboardEventParticipantsUrl, participantTripUrl, publicEventUrl } from "@/lib/urls";
import { signParticipantToken, getParticipantAuthSecret } from "@/lib/participant-auth";

const PENDING_TTL_MS = 30 * 60 * 1000;
const DEDUPE_WINDOW_MS = 60 * 1000;

export const LEGACY_ATTENDEE_TYPE_ID = "__legacy__";

/**
 * Price of each attendee row (same order as the rows), from the graduated
 * pricing breakdown: the n-th attendee of a type gets that type's n-th price.
 */
function attendeePrices(rows: AttendeeFormRow[], pricing: PriceCalculation): number[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const pos = (seen.get(r.attendeeTypeId) ?? 0) + 1;
    seen.set(r.attendeeTypeId, pos);
    const breakdown = pricing.perType.find((t) => t.typeId === r.attendeeTypeId)?.breakdown ?? [];
    return breakdown[pos - 1]?.priceCents ?? 0;
  });
}

function buildAttendeeInserts(
  attendeeRows: AttendeeFormRow[],
  participantId: string,
  now: number,
  prices: number[],
): NewAttendee[] {
  return attendeeRows.map((r, i) => ({
    id: newId(),
    participantId,
    attendeeTypeId: r.attendeeTypeId,
    firstName: r.firstName,
    lastName: r.lastName,
    customAnswers: JSON.stringify(r.customAnswers ?? {}),
    priceCents: prices[i],
    cancelledAt: null,
    createdAt: now,
  }));
}

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

/** Consent records are legal evidence: write them before responding, log failures. */
async function recordConsentsLogged(
  participantId: string,
  form: FormData,
  eventConsents: ConsentConfigItem[],
  ip: string | null,
) {
  try {
    await recordParticipantConsents(participantId, form, eventConsents, ip);
  } catch (err) {
    console.error("[consent-recording] Failed to record consents for participant", participantId, err);
  }
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

type GetAttendeeTypesResult =
  | { kind: "ok"; types: AttendeeType[] }
  | { kind: "legacy" }
  | { kind: "error" };

function getAttendeeTypes(event: { attendeeTypes: string | null }): GetAttendeeTypesResult {
  if (!event.attendeeTypes) return { kind: "legacy" };
  try {
    return { kind: "ok", types: JSON.parse(event.attendeeTypes) as AttendeeType[] };
  } catch (err) {
    console.error("[process-registration] Failed to parse event.attendeeTypes JSON", err);
    return { kind: "error" };
  }
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

  const stripeAccountId = organizer.stripeAccountId;
  if (
    !stripeAccountId ||
    organizer.stripeOnboardingComplete !== 1 ||
    organizer.stripePayoutsEnabled !== 1
  ) {
    return { errors: { _form: "Rejestracja chwilowo niedostępna." } };
  }

  const event = await getPublishedEventBySlug(organizer.id, slug);
  if (!event || event.id !== parsedRegistrant.data.eventId) {
    return { errors: { _form: "Nie znaleziono wydarzenia." } };
  }

  const attendeeTypesResult = getAttendeeTypes(event);
  if (attendeeTypesResult.kind === "error") {
    return { errors: { _form: "Nieprawidłowa konfiguracja wydarzenia." } };
  }
  const isLegacyMode = attendeeTypesResult.kind === "legacy";
  const attendeeTypes: AttendeeType[] = isLegacyMode
    ? [
        {
          id: LEGACY_ATTENDEE_TYPE_ID,
          name: "Uczestnik",
          minQty: 1,
          maxQty: 1,
          priceCents: event.priceCents,
        },
      ]
    : attendeeTypesResult.types;

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
    const shapeCheck = attendeesFormSchema.safeParse(parsedAttendees.rows);
    if (!shapeCheck.success) {
      const attendeeErrors: Record<string, string> = {};
      for (const issue of shapeCheck.error.issues) {
        const [idx, field, ...rest] = issue.path;
        if (typeof idx === "number" && typeof field === "string") {
          const key = field === "customAnswers" && rest.length > 0
            ? `attendees[${idx}][field_${String(rest[0])}]`
            : `attendees[${idx}][${field}]`;
          attendeeErrors[key] = issue.message;
        } else {
          attendeeErrors._form = issue.message;
        }
      }
      return { errors: attendeeErrors };
    }
    const countErrors = validateAttendeeCountsAgainstTypes(shapeCheck.data, attendeeTypes);
    if (Object.keys(countErrors).length > 0) return { errors: countErrors };
    attendeeRows = shapeCheck.data;
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
  const pricing = calculateTotal(attendeeTypes, quantities);
  const totalCents = pricing.total;
  const requestedSpots = attendeeRows.length;
  const email = normalizeEmail(parsedRegistrant.data.email);

  const now = Date.now();
  const origin = await eventSiteOrigin(subdomain, requestProtocol);

  const planned = tryPlanFirstPayment({
    totalCents,
    depositPerPersonCents: event.depositCents,
    attendeeCount: attendeeRows.length,
    balanceDueAt: event.balanceDueAt,
    nowMs: now,
  });
  if (!planned) {
    console.error("[process-registration] total below minimum charge", { eventId: event.id, totalCents });
    return { errors: { _form: "Nie można przyjąć płatności za to wydarzenie. Skontaktuj się z organizatorem." } };
  }
  const plan = planned;

  // Duplicate-submit dedupe: if the same email+eventId registered in the
  // dedupe window and isn't cancelled, bounce them to their trip page rather
  // than creating a second participant + Stripe session. The trip page lets
  // a pending registration go back to its checkout.
  const existingDup = await findRecentParticipantForDedupe({
    eventId: event.id,
    email,
    sinceMs: now - DEDUPE_WINDOW_MS,
  });
  if (existingDup) {
    const secret = getParticipantAuthSecret();
    const token = await signParticipantToken(existingDup.id, secret);
    return {
      redirectUrl: `${participantTripUrl(existingDup.id)}?t=${encodeURIComponent(token)}`,
    };
  }

  const participantId = newId();
  const attendeeInserts = isLegacyMode
    ? []
    : buildAttendeeInserts(attendeeRows, participantId, now, attendeePrices(attendeeRows, pricing));
  const participantRow = {
    id: participantId,
    eventId: event.id,
    firstName: parsedRegistrant.data.firstName,
    lastName: parsedRegistrant.data.lastName,
    email,
    phone: parsedRegistrant.data.phone ?? null,
    customAnswers: JSON.stringify(answers),
    createdAt: now,
    updatedAt: now,
  };
  const replyTo = organizer.contactEmail;
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const paymentId = newId();
  const isFree = plan.kind === "free";

  // Capacity check, participant, attendees and first payment in one batch.
  // If it returns false the event is full: fall through to the waitlist.
  const admittedActive = await registerActiveParticipant({
    participant: { ...participantRow, lifecycleStatus: "active" },
    attendees: attendeeInserts,
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
      expiresAt: isFree ? null : now + PENDING_TTL_MS,
      createdAt: now,
      updatedAt: now,
    },
    requestedSeats: requestedSpots,
    capacity: event.capacity,
    nowMs: now,
  });

  if (!admittedActive) {
    await insertParticipantWithAttendees(
      { ...participantRow, lifecycleStatus: "waitlisted" },
      attendeeInserts,
    );
    await recordConsentsLogged(participantId, form, consents, ip);

    const organizerEmail = organizer.contactEmail;
    runAfterResponse("waitlist emails", async () => {
      const token = await signParticipantToken(participantId, getParticipantAuthSecret());
      const myTripsUrl = `${participantTripUrl(participantId)}?t=${encodeURIComponent(token)}`;
      const emails: Promise<void>[] = [
        sendWaitlistConfirmation({
          to: email,
          participantName: parsedRegistrant.data.firstName,
          eventTitle: event.title,
          eventUrl: `${origin}/${slug}`,
          organizerName: organizer.displayName,
          myTripsUrl,
          replyTo,
        }),
      ];
      if (organizerEmail) {
        const takenAfter = await countTakenSpots(event.id, Date.now());
        emails.push(
          sendOrganizerNewRegistration({
            to: organizerEmail,
            participantName: `${parsedRegistrant.data.firstName} ${parsedRegistrant.data.lastName}`,
            participantEmail: email,
            eventTitle: event.title,
            spotsInfo: `${takenAfter} / ${event.capacity} (pełne)`,
            isWaitlisted: true,
            dashboardUrl: dashboardEventParticipantsUrl(event.id),
          }),
        );
      }
      await Promise.allSettled(emails);
    });

    return { redirectUrl: `${origin}/${slug}/thanks?waitlisted=1` };
  }

  await recordConsentsLogged(participantId, form, consents, ip);

  if (isFree) {
    // Free registration: no checkout. Mirror the notifications the Stripe
    // webhook would send on payment (participant confirmation + organizer).
    const organizerEmail = organizer.contactEmail;
    runAfterResponse("free registration emails", async () => {
      const token = await signParticipantToken(participantId, getParticipantAuthSecret());
      const myTripsUrl = `${participantTripUrl(participantId)}?t=${encodeURIComponent(token)}`;
      const emails: Promise<void>[] = [
        sendPaymentConfirmation({
          to: email,
          participantName: parsedRegistrant.data.firstName,
          eventTitle: event.title,
          eventDate: formatWarsawDate(event.startsAt),
          eventLocation: event.location,
          eventUrl: publicEventUrl(subdomain, slug),
          organizerName: organizer.displayName,
          paymentKind: "full",
          amountCents: 0,
          myTripsUrl,
          replyTo,
        }),
      ];
      if (organizerEmail) {
        const takenAfter = await countTakenSpots(event.id, Date.now());
        emails.push(
          sendOrganizerNewRegistration({
            to: organizerEmail,
            participantName: `${parsedRegistrant.data.firstName} ${parsedRegistrant.data.lastName}`,
            participantEmail: email,
            eventTitle: event.title,
            spotsInfo: `${takenAfter} / ${event.capacity}`,
            isWaitlisted: false,
            dashboardUrl: dashboardEventParticipantsUrl(event.id),
          }),
        );
      }
      await Promise.allSettled(emails);
    });

    return { redirectUrl: `${origin}/${slug}/thanks?pid=${participantId}` };
  }

  try {
    const session = await createCheckoutSession({
      stripeAccountId,
      customerEmail: email,
      amountCents: plan.amountCents,
      productName: firstPaymentProductName(plan.kind, event.title),
      paymentId,
      participantId,
      successUrl: `${origin}/${slug}/thanks?pid=${participantId}`,
      cancelUrl: `${origin}/${slug}/register`,
      expiresAtMs: now + PENDING_TTL_MS,
    });
    await setPaymentStripeSession(paymentId, session.id);
    return { redirectUrl: session.url };
  } catch (err) {
    // No checkout exists, so the place must not stay held for 30 minutes.
    console.error("[process-registration] checkout session failed", { participantId, err });
    await markPaymentFailedIfPending(paymentId, null).catch(() => {});
    return { errors: { _form: "Nie udało się utworzyć sesji płatności. Spróbuj ponownie." } };
  }
}

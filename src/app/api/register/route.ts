import { NextRequest, NextResponse } from "next/server";
import { registrationBaseSchema } from "@/lib/validators/registration";
import type { CustomQuestion } from "@/lib/validators/event";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";
import { getPublishedEventBySlug } from "@/lib/db/queries/events";
import { countTakenSpots } from "@/lib/capacity";
import {
  insertParticipant,
  setStripeSessionId,
} from "@/lib/db/queries/participants";
import { newId } from "@/lib/ids";
import { getStripe } from "@/lib/stripe";

const PENDING_TTL_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const parsed = registrationBaseSchema.safeParse({
    eventId: form.get("eventId"),
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    email: form.get("email"),
    phone: form.get("phone") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const subdomain = String(form.get("organizerSubdomain") ?? "");
  const slug = String(form.get("eventSlug") ?? "");
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const event = await getPublishedEventBySlug(organizer.id, slug);
  if (!event || event.id !== parsed.data.eventId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Collect custom answers
  const questions: CustomQuestion[] = event.customQuestions
    ? JSON.parse(event.customQuestions)
    : [];
  const answers: Record<string, string> = {};
  for (const q of questions) {
    const v = form.get(`q_${q.id}`);
    if (q.required && (!v || String(v).trim() === "")) {
      return NextResponse.json({ error: `Pole "${q.label}" jest wymagane` }, { status: 400 });
    }
    if (v) answers[q.id] = String(v);
  }

  const now = Date.now();
  const taken = await countTakenSpots(event.id, now);
  const isFull = taken >= event.capacity;

  const participantId = newId();
  const rootHost = subdomain + "." + (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000");
  const proto = req.nextUrl.protocol; // includes trailing ':'
  const origin = `${proto}//${rootHost}`;

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
    return NextResponse.redirect(`${origin}/${slug}/thanks?waitlisted=1`, 303);
  }

  // Create pending participant, then create Stripe Checkout Session
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
    // Also put the participant_id on the PaymentIntent so payment_intent.payment_failed
    // webhooks can find the participant.
    payment_intent_data: {
      metadata: { participant_id: participantId },
    },
    success_url: `${origin}/${slug}/thanks?pid=${participantId}`,
    cancel_url: `${origin}/${slug}/register`,
    expires_at: Math.floor((now + PENDING_TTL_MS) / 1000),
  });

  await setStripeSessionId(participantId, session.id);

  return NextResponse.redirect(session.url!, 303);
}

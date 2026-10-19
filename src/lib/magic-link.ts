import { signMagicLinkOneTime, getParticipantAuthSecret } from "@/lib/participant-auth";
import { sendMagicLinkEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/db/queries/participants";

/**
 * Sends a /my-trips sign-in link. Rate limited per IP and per address so the
 * form cannot be used to flood someone's inbox. Returns false when limited;
 * callers show the same "sent" screen either way.
 */
export async function requestMagicLink(params: { email: string; ip: string; origin: string }): Promise<boolean> {
  const email = normalizeEmail(params.email);
  if (!checkRateLimit(`magic-link:${params.ip}`) || !checkRateLimit(`magic-link-email:${email}`)) {
    return false;
  }
  const token = await signMagicLinkOneTime(email, Date.now(), getParticipantAuthSecret());
  const link = `${params.origin}/my-trips/signin?token=${encodeURIComponent(token)}`;
  await sendMagicLinkEmail({ to: email, link });
  return true;
}

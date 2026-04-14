import { Resend } from "resend";
import { getCloudflareContext } from "@opennextjs/cloudflare";

let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const { env } = getCloudflareContext();
  const key = env.RESEND_API_KEY;
  if (!key || key === "re_YOUR_KEY_HERE") {
    throw new Error("RESEND_API_KEY not configured");
  }
  cached = new Resend(key);
  return cached;
}

/**
 * "no-reply@wyjazdo.pl" for production, Resend test address for development.
 * Resend requires a verified domain to send from. Until verified, use their
 * test address (only delivers to the account owner's email).
 */
export const FROM_EMAIL = "Wyjazdo <no-reply@wyjazdo.pl>";

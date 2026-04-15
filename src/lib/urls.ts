/**
 * Centralized URL builders. All callers should use these instead of
 * hardcoding "wyjazdo.pl" — the value is built from NEXT_PUBLIC_ROOT_DOMAIN
 * which is correctly set per environment via .env.development / .env.production.
 */

function rootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";
}

/**
 * In production NEXT_PUBLIC_ROOT_DOMAIN is "wyjazdo.pl" → https://.
 * In dev it's "localhost:3000" → http:// (no TLS).
 */
function protocol(): string {
  return rootDomain().startsWith("localhost") ? "http" : "https";
}

/** Absolute URL of an organizer's public event page. */
export function publicEventUrl(subdomain: string, eventSlug: string): string {
  return `${protocol()}://${subdomain}.${rootDomain()}/${eventSlug}`;
}

/** Absolute URL of an organizer's public profile page. */
export function publicOrganizerUrl(subdomain: string): string {
  return `${protocol()}://${subdomain}.${rootDomain()}`;
}

/** Absolute URL of the organizer's dashboard event edit page. */
export function dashboardEventUrl(eventId: string): string {
  return `${protocol()}://${rootDomain()}/dashboard/events/${eventId}`;
}

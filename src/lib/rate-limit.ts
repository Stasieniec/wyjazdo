/**
 * Simple sliding-window rate limiter for Cloudflare Workers.
 *
 * Uses a global Map that resets when the worker isolate recycles.
 * This is intentional — we don't need Redis-grade precision, just basic
 * abuse prevention against bots and accidental double-clicks.
 *
 * For MVP this is sufficient. If needed later, swap to Cloudflare Rate Limiting
 * binding or a D1-backed counter.
 */

const windowMs = 60_000; // 1 minute
const maxPerWindow = 5;

const hits = new Map<string, number[]>();

/**
 * Returns true if the request should be allowed, false if rate-limited.
 * @param key — typically IP address or `ip:email` combo
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = hits.get(key) ?? [];

  // Purge entries outside the window
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxPerWindow) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}

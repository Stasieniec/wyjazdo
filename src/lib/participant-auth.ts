// Web-crypto HMAC-SHA256 utilities for participant-facing tokens and cookies.
// No DB lookup required; secret rotation is the only invalidation mechanism.

const COOKIE_TTL_MS = 30 * 86_400_000; // 30 days
const ONE_TIME_TTL_MS = 15 * 60_000;   // 15 minutes

const enc = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bytesToBase64Url(new Uint8Array(sig));
}

function bytesToBase64Url(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToString(s: string): string {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ── Per-participant token (long-lived, no expiry) ──────────────────────────

export async function signParticipantToken(participantId: string, secret: string): Promise<string> {
  const payload = `pt:${participantId}`;
  return await hmac(secret, payload);
}

export async function verifyParticipantToken(
  token: string,
  participantId: string,
  secret: string,
): Promise<boolean> {
  const expected = await signParticipantToken(participantId, secret);
  return constantTimeEq(token, expected);
}

// ── Email-scoped magic-link cookie (30-day TTL) ────────────────────────────

function encodeCookieBody(email: string, issuedAt: number): string {
  return bytesToBase64Url(enc.encode(JSON.stringify({ e: email, t: issuedAt })));
}

function decodeCookieBody(s: string): { email: string; issuedAt: number } | null {
  try {
    const obj = JSON.parse(base64UrlToString(s));
    if (typeof obj?.e === "string" && typeof obj?.t === "number") {
      return { email: obj.e, issuedAt: obj.t };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signMagicLinkCookie(
  email: string,
  issuedAt: number,
  secret: string,
): Promise<string> {
  const body = encodeCookieBody(email, issuedAt);
  const sig = await hmac(secret, `cookie:${body}`);
  return `${body}.${sig}`;
}

export async function verifyMagicLinkCookie(
  cookie: string,
  secret: string,
  nowMs: number,
): Promise<{ email: string; issuedAt: number } | null> {
  const [body, sig] = cookie.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(secret, `cookie:${body}`);
  if (!constantTimeEq(sig, expected)) return null;
  const decoded = decodeCookieBody(body);
  if (!decoded) return null;
  if (decoded.issuedAt + COOKIE_TTL_MS < nowMs) return null;
  return decoded;
}

// ── Short-lived one-time token for request-link flow ───────────────────────

export async function signMagicLinkOneTime(
  email: string,
  issuedAt: number,
  secret: string,
): Promise<string> {
  const body = encodeCookieBody(email, issuedAt);
  const sig = await hmac(secret, `ot:${body}`);
  return `${body}.${sig}`;
}

export async function verifyMagicLinkOneTime(
  token: string,
  secret: string,
  nowMs: number,
): Promise<{ email: string; issuedAt: number } | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(secret, `ot:${body}`);
  if (!constantTimeEq(sig, expected)) return null;
  const decoded = decodeCookieBody(body);
  if (!decoded) return null;
  if (decoded.issuedAt + ONE_TIME_TTL_MS < nowMs) return null;
  return decoded;
}

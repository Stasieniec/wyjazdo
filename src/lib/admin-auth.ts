import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// HMAC-SHA256 signed admin session cookie. Stateless: no DB lookup.
// Format: `${issuedAtMs}.${hmac_base64url}`. TTL enforced at verify time.

export const ADMIN_SESSION_TTL_MS = 7 * 86_400_000; // 7 days
export const ADMIN_SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60_000; // 24h
export const ADMIN_SESSION_COOKIE = "admin_session";

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

export function constantTimeStringEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signAdminSession(issuedAtMs: number, secret: string): Promise<string> {
  const body = String(issuedAtMs);
  const sig = await hmac(secret, `admin:${body}`);
  return `${body}.${sig}`;
}

export async function verifyAdminSession(
  cookie: string,
  secret: string,
  nowMs: number,
): Promise<{ issuedAtMs: number } | null> {
  if (!cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return null;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = await hmac(secret, `admin:${body}`);
  if (!constantTimeStringEq(sig, expected)) return null;
  const issuedAtMs = Number(body);
  if (!Number.isFinite(issuedAtMs)) return null;
  if (issuedAtMs + ADMIN_SESSION_TTL_MS < nowMs) return null;
  return { issuedAtMs };
}

// ── Environment binding accessors ──────────────────────────────────────────

export function getAdminPassword(): string {
  const { env } = getCloudflareContext();
  const p = (env as unknown as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD;
  if (!p) throw new Error("ADMIN_PASSWORD not set");
  return p;
}

export function getAdminSessionSecret(): string {
  const { env } = getCloudflareContext();
  const s = (env as unknown as { ADMIN_SESSION_SECRET?: string }).ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET not set");
  return s;
}

// ── Session cookie management ──────────────────────────────────────────────

const isProd = process.env.NODE_ENV === "production";

export async function issueAdminSessionCookie(nowMs: number = Date.now()): Promise<void> {
  const secret = getAdminSessionSecret();
  const value = await signAdminSession(nowMs, secret);
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/admin",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/admin",
    maxAge: 0,
  });
}

export async function requireAdmin(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) redirect("/admin/login");

  const secret = getAdminSessionSecret();
  const nowMs = Date.now();
  const result = await verifyAdminSession(raw, secret, nowMs);
  if (!result) redirect("/admin/login");

  const remaining = result.issuedAtMs + ADMIN_SESSION_TTL_MS - nowMs;
  if (remaining < ADMIN_SESSION_REFRESH_THRESHOLD_MS) {
    await issueAdminSessionCookie(nowMs);
  }
}

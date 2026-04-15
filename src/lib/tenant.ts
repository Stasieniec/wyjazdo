import { RESERVED_SUBDOMAINS } from "@/lib/validators/organizer";

export type TenantResolution =
  | { kind: "apex" }
  | { kind: "tenant"; subdomain: string }
  | { kind: "unknown" };

export function resolveTenant(host: string, rootDomain: string): TenantResolution {
  const normalized = host.toLowerCase();
  const rootNormalized = rootDomain.toLowerCase();

  if (normalized === rootNormalized) return { kind: "apex" };

  const suffix = "." + rootNormalized;
  if (!normalized.endsWith(suffix)) return { kind: "unknown" };

  const sub = normalized.slice(0, -suffix.length);
  // reject multi-level subdomains in MVP
  if (sub.includes(".")) return { kind: "unknown" };
  if (RESERVED_SUBDOMAINS.has(sub)) return { kind: "apex" };
  return { kind: "tenant", subdomain: sub };
}

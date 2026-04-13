import { z } from "zod";

export const subdomainSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Dozwolone małe litery, cyfry i myślniki");

export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "dashboard", "admin", "assets", "static",
  "help", "support", "mail", "blog",
]);

export const organizerProfileSchema = z.object({
  subdomain: subdomainSchema.refine((s) => !RESERVED_SUBDOMAINS.has(s), "Ta nazwa jest zarezerwowana"),
  displayName: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
});

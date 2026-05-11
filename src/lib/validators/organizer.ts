import { z } from "zod";

export const subdomainSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Dozwolone małe litery, cyfry i myślniki");

export const RESERVED_SUBDOMAINS = new Set([
  // Infra / system
  "www", "app", "api", "cdn", "static", "assets", "media", "images", "files",
  "mail", "smtp", "status", "health", "secure", "security",
  // Current app routes (must not be claimable — would shadow root pages)
  "dashboard", "onboarding", "my-trips", "pomoc",
  "sign-in", "sign-up", "signin", "signup",
  "regulamin", "polityka-prywatnosci", "dpa", "cookies", "organizer-terms",
  // Auth / account synonyms
  "admin", "auth", "login", "logout", "account", "accounts", "user", "users",
  // Help / content
  "help", "support", "contact", "kontakt", "about", "info", "blog", "news",
  "docs", "faq",
  // Commerce / payments
  "billing", "pay", "payment", "payments", "checkout", "stripe",
  "webhook", "webhooks",
  // Brand
  "wyjazdo", "wyjazd",
  // Environments / ops
  "dev", "staging", "test", "prod", "production", "preview", "demo",
  "root", "host", "system", "internal", "private",
  "email", "emails",
]);

export const organizerProfileSchema = z.object({
  subdomain: subdomainSchema.refine((s) => !RESERVED_SUBDOMAINS.has(s), "Ta nazwa jest zarezerwowana"),
  displayName: z.string().min(1).max(100),
  contactEmail: z.string().email("Nieprawidłowy adres email").max(200),
  description: z.string().max(2000).optional(),
  acceptTerms: z.literal(true, {
    message: "Akceptacja regulaminu jest wymagana.",
  }),
  acceptPrivacy: z.literal(true, {
    message: "Zapoznanie się z polityką prywatności jest wymagane.",
  }),
  acceptDpa: z.literal(true, {
    message: "Akceptacja umowy powierzenia danych jest wymagana.",
  }),
});

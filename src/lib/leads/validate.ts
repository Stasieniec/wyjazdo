import { z } from "zod";

/**
 * Normalises a Polish phone number to +48XXXXXXXXX. Accepts spaces, dashes,
 * dots and brackets as separators and an optional +48 / 0048 / 48 prefix.
 * Returns null when the input is not a Polish number.
 */
export function normalizePolishPhone(raw: string): string | null {
  const compact = raw.replace(/[\s\-.()]/g, "");
  const match = /^(?:\+48|0048|48)?([1-9]\d{8})$/.exec(compact);
  return match ? `+48${match[1]}` : null;
}

const emailSchema = z.email();

export type ParsedContact = { kind: "phone" | "email"; value: string };

/** Telefon albo e-mail: returns the normalised value, or null if neither. */
export function parseContact(raw: string): ParsedContact | null {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    const lower = trimmed.toLowerCase();
    return emailSchema.safeParse(lower).success ? { kind: "email", value: lower } : null;
  }
  const phone = normalizePolishPhone(trimmed);
  return phone ? { kind: "phone", value: phone } : null;
}

export const CONTACT_ERROR = "Wpisz numer telefonu (9 cyfr) albo adres e-mail.";

export const leadInputSchema = z.object({
  contact: z
    .string()
    .trim()
    .min(1, CONTACT_ERROR)
    .max(200, CONTACT_ERROR)
    .transform((value, ctx) => {
      const parsed = parseContact(value);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: CONTACT_ERROR });
        return z.NEVER;
      }
      return parsed;
    }),
  name: z
    .string()
    .trim()
    .max(100, "Imię może mieć najwyżej 100 znaków.")
    .optional()
    .transform((v) => (v ? v : null)),
});

export type LeadInput = z.output<typeof leadInputSchema>;

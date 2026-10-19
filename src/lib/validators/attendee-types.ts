import { z } from "zod";
import { isChargeableOrFree } from "@/lib/payment-plan";

const MIN_PRICE_MESSAGE = "Cena musi wynosić 0 zł (bezpłatnie) albo co najmniej 2 zł.";

export const attendeeCustomFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  type: z.enum(["text", "long_text", "select", "number", "date"]),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
});
export type AttendeeCustomField = z.infer<typeof attendeeCustomFieldSchema>;

export const graduatedPricingTierSchema = z.object({
  fromQty: z.number().int().min(2),
  priceCents: z.number().int().nonnegative().refine(isChargeableOrFree, MIN_PRICE_MESSAGE),
});
export type GraduatedPricingTier = z.infer<typeof graduatedPricingTierSchema>;

export const attendeeTypeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    minQty: z.number().int().min(0).max(50),
    maxQty: z.number().int().min(1).max(50),
    priceCents: z.number().int().nonnegative().refine(isChargeableOrFree, MIN_PRICE_MESSAGE),
    graduatedPricing: z.array(graduatedPricingTierSchema).max(10).optional(),
    customFields: z.array(attendeeCustomFieldSchema).max(20).optional(),
  })
  .refine((t) => t.maxQty >= t.minQty, {
    message: "Maksymalna ilość musi być większa lub równa minimalnej.",
    path: ["maxQty"],
  });
export type AttendeeType = z.infer<typeof attendeeTypeSchema>;

export const attendeeTypesSchema = z.array(attendeeTypeSchema).min(1).max(10);

/** Error text for a failed attendeeTypesSchema parse: the price rule if that was it, else generic. */
export function attendeeTypesErrorMessage(error: z.ZodError): string {
  return error.issues.some((i) => i.message === MIN_PRICE_MESSAGE)
    ? MIN_PRICE_MESSAGE
    : "Niepoprawna konfiguracja typów uczestników.";
}

/**
 * Strip empty option strings and validate each per-attendee field, dropping
 * malformed entries silently. Used by save actions before persisting so an
 * editor row left blank during typing doesn't sit in the DB and break
 * publish-time validation later.
 */
export function sanitizeAttendeeCustomFields(input: unknown): AttendeeCustomField[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const cleaned: AttendeeCustomField[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const candidate: Record<string, unknown> = {
      id: o.id,
      label: o.label,
      type: o.type,
      required: !!o.required,
    };
    if (o.type === "select" && Array.isArray(o.options)) {
      const opts = (o.options as unknown[])
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean);
      if (opts.length > 0) candidate.options = opts;
    }
    const parsed = attendeeCustomFieldSchema.safeParse(candidate);
    if (parsed.success) cleaned.push(parsed.data);
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

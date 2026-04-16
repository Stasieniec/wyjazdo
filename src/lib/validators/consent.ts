import { z } from "zod";

/**
 * A single consent item configured by the organizer for an event.
 * Platform-required consents (regulamin, privacy) are NOT stored here --
 * they are always rendered and always mandatory.
 */
export const consentConfigItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  required: z.boolean(),
  category: z.enum(["general", "photo", "health", "marketing", "custom"]),
});
export type ConsentConfigItem = z.infer<typeof consentConfigItemSchema>;

export const consentConfigSchema = z.array(consentConfigItemSchema).max(20).default([]);

/**
 * Consent payload submitted by a participant during registration.
 * Keys are consent IDs, values are booleans.
 */
export const consentPayloadSchema = z.record(z.string(), z.boolean());

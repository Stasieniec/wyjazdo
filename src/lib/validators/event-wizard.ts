import { z } from "zod";

export const stepTitleSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Dozwolone małe litery, cyfry i myślniki"),
});

export const stepDescriptionSchema = z.object({
  description: z.string().max(10_000).optional(),
});

export const stepDatesSchema = z
  .object({
    startsAt: z.number().int().positive(),
    endsAt: z.number().int().positive(),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: "Koniec wydarzenia musi być po jego początku.",
    path: ["endsAt"],
  });

export const stepLocationSchema = z.object({
  location: z.string().max(200).optional(),
});

// step "uczestnicy" reuses attendeeTypesSchema directly — see actions

export const stepCapacitySchema = z.object({
  capacity: z.number().int().min(1).max(10_000),
});

export const stepPaymentSchema = z
  .object({
    depositOn: z.boolean(),
    depositCents: z.coerce.number().int().nonnegative().nullable().optional(),
    balanceDueAt: z.coerce.number().int().positive().nullable().optional(),
  })
  .refine(
    (d) =>
      !d.depositOn ||
      (d.depositCents != null && d.depositCents > 0 && d.balanceDueAt != null),
    {
      message: "Podaj zaliczkę i termin dopłaty.",
      path: ["depositCents"],
    },
  );

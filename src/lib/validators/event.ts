import { z } from "zod";

export const customQuestionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  type: z.enum(["short_text", "long_text", "select"]),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
});
export type CustomQuestion = z.infer<typeof customQuestionSchema>;

export const eventBaseSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Dozwolone małe litery, cyfry i myślniki"),
    title: z.string().min(1).max(200),
    description: z.string().max(10_000).optional(),
    location: z.string().max(200).optional(),
    startsAt: z.number().int().positive(),
    endsAt: z.number().int().positive(),
    priceCents: z.number().int().nonnegative(),
    currency: z.literal("PLN"),
    capacity: z.number().int().min(1).max(10_000),
    coverUrl: z
      .string()
      .refine(
        (v) => v === "" || v.startsWith("/api/images/") || v.startsWith("http"),
        "Nieprawidłowy adres zdjęcia",
      )
      .optional()
      .or(z.literal("")),
    customQuestions: z.array(customQuestionSchema).max(20).default([]),
    depositCents: z.coerce.number().int().nonnegative().nullable().optional(),
    balanceDueAt: z.coerce.number().int().positive().nullable().optional(),
  })
  .refine(
    (d) =>
      d.depositCents == null || d.depositCents === 0 || d.depositCents <= d.priceCents,
    { message: "Zaliczka nie może przekraczać ceny.", path: ["depositCents"] },
  )
  .refine(
    (d) =>
      d.depositCents == null ||
      d.depositCents === 0 ||
      d.depositCents === d.priceCents ||
      d.balanceDueAt != null,
    {
      message: "Podaj termin dopłaty, gdy zaliczka jest niższa niż cena.",
      path: ["balanceDueAt"],
    },
  )
  .refine(
    (d) => d.balanceDueAt == null || d.balanceDueAt < d.startsAt,
    {
      message: "Termin dopłaty musi być przed rozpoczęciem.",
      path: ["balanceDueAt"],
    },
  );
export type EventBase = z.infer<typeof eventBaseSchema>;

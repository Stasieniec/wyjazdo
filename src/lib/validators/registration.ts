import { z } from "zod";
import { attendeesFormSchema } from "./attendees-form";

export const registrationBaseSchema = z.object({
  eventId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(32).optional(),
});

export const registrationWithAttendeesSchema = registrationBaseSchema.extend({
  attendees: attendeesFormSchema,
});

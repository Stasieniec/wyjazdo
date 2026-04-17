import { z } from "zod";

export const attendeeFormRowSchema = z.object({
  attendeeTypeId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  customAnswers: z.record(z.string(), z.string()).default({}),
});
export type AttendeeFormRow = z.infer<typeof attendeeFormRowSchema>;

export const attendeesFormSchema = z.array(attendeeFormRowSchema).min(1).max(50);

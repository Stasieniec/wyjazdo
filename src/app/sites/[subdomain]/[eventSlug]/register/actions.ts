"use server";

import { redirect } from "next/navigation";
import { processRegistration } from "@/lib/register/process-registration";

export type RegisterFormState = { errors?: Record<string, string> } | null;

export async function registerAction(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const result = await processRegistration(formData);
  if ("errors" in result) return result;
  redirect(result.redirectUrl);
}

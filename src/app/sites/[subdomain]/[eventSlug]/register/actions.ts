"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { processRegistration } from "@/lib/register/process-registration";
import { checkRateLimit } from "@/lib/rate-limit";

export type RegisterFormState = { errors?: Record<string, string> } | null;

export async function registerAction(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Per IP and address, plus a looser per-IP cap so a shared office or
  // family connection can still register several people.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!checkRateLimit(`register:${ip}:${email}`) || !checkRateLimit(`register:${ip}`, 20)) {
    return { errors: { _form: "Zbyt wiele prób. Spróbuj ponownie za minutę." } };
  }
  const result = await processRegistration(formData);
  if ("errors" in result) return result;
  redirect(result.redirectUrl);
}

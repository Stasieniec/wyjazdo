"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  constantTimeStringEq,
  getAdminPassword,
  issueAdminSessionCookie,
} from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function loginAction(formData: FormData): Promise<{ error?: string } | void> {
  const h = await headers();
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (!checkRateLimit(`admin-login:${ip}`)) {
    return { error: "Nieprawidłowe hasło lub zbyt wiele prób." };
  }

  const submitted = String(formData.get("password") ?? "");
  let expected: string;
  try {
    expected = getAdminPassword();
  } catch {
    return { error: "Panel nie jest skonfigurowany." };
  }

  if (!constantTimeStringEq(submitted, expected)) {
    return { error: "Nieprawidłowe hasło lub zbyt wiele prób." };
  }

  await issueAdminSessionCookie();
  redirect("/admin");
}

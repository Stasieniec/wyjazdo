"use server";

import { headers } from "next/headers";
import { submitLead, type CallbackFormState } from "@/lib/leads/submit";

/** "Poproś o kontakt" dialog on the landing page. */
export async function requestCallbackAction(
  _prev: CallbackFormState,
  formData: FormData,
): Promise<CallbackFormState> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return submitLead(
    {
      contact: formData.get("contact"),
      name: formData.get("name"),
      website: formData.get("website"),
    },
    { ip, userAgent: h.get("user-agent") },
  );
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { sendLeadNotification } from "@/lib/email/send";
import { newId } from "@/lib/ids";
import { checkRateLimit } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/urls";
import { leadInputSchema } from "./validate";

export type CallbackFormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      fieldErrors: { contact?: string; name?: string };
      formError?: string;
      values: { contact: string; name: string };
    };

export const RATE_LIMIT_ERROR = "Za dużo prób w krótkim czasie. Spróbuj ponownie za minutę.";
export const SAVE_ERROR =
  "Nie udało się wysłać. Spróbuj ponownie albo napisz na kontakt@wyjazdo.pl.";

function readNotifyEmail(): string | null {
  try {
    const value: string | undefined = getCloudflareContext().env.LEADS_NOTIFY_EMAIL;
    return value?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Validates, stores and announces a call-back request. The lead is stored
 * even when the notification email cannot go out; the admin panel lists it.
 */
export async function submitLead(
  raw: { contact: unknown; name: unknown; website?: unknown },
  meta: { ip: string | null; userAgent: string | null; now?: number },
): Promise<CallbackFormState> {
  const values = {
    contact: typeof raw.contact === "string" ? raw.contact : "",
    name: typeof raw.name === "string" ? raw.name : "",
  };

  // Hidden field that people never see. Bots that fill it get a quiet success.
  if (typeof raw.website === "string" && raw.website.trim() !== "") {
    return { status: "success" };
  }

  if (!checkRateLimit(`lead:${meta.ip ?? "unknown"}`)) {
    return { status: "error", fieldErrors: {}, formError: RATE_LIMIT_ERROR, values };
  }

  const parsed = leadInputSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: { contact?: string; name?: string } = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "contact" || key === "name") && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { status: "error", fieldErrors, values };
  }

  const createdAt = meta.now ?? Date.now();
  const lead = {
    id: newId(),
    contact: parsed.data.contact.value,
    name: parsed.data.name,
    createdAt,
    ip: meta.ip,
    userAgent: meta.userAgent?.slice(0, 500) ?? null,
  };

  try {
    await getDb().insert(leads).values(lead);
  } catch (err) {
    console.error("[leads] insert failed:", err);
    return { status: "error", fieldErrors: {}, formError: SAVE_ERROR, values };
  }

  const notifyTo = readNotifyEmail();
  if (!notifyTo) {
    console.warn("[leads] LEADS_NOTIFY_EMAIL is not set; lead stored without notification", {
      id: lead.id,
    });
  } else {
    await sendLeadNotification({
      to: notifyTo,
      contact: lead.contact,
      contactKind: parsed.data.contact.kind,
      name: lead.name,
      createdAt,
      adminUrl: `${siteOrigin()}/admin/leads`,
    });
  }

  return { status: "success" };
}

"use server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { createManualPayout } from "@/lib/stripe-finance";
import { createExpressLoginLink } from "@/lib/stripe-connect";
import { revalidatePath } from "next/cache";

export async function payoutAvailableAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer || !organizer.stripeAccountId) throw new Error("not connected");

  const amountMinor = Number(form.get("amountMinor"));
  const currency = String(form.get("currency") ?? "pln");
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error("invalid amount");

  await createManualPayout({
    accountId: organizer.stripeAccountId,
    amountMinorUnits: amountMinor,
    currency,
  });
  revalidatePath("/dashboard/finance");
}

export async function openExpressDashboardAction(): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer || !organizer.stripeAccountId) throw new Error("not connected");
  const { url } = await createExpressLoginLink(organizer.stripeAccountId);
  redirect(url);
}

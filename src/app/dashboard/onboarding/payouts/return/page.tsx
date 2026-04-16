import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { reconcileAccount, refreshOnboardingLink } from "@/lib/stripe-connect";

function origin() {
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  return `${proto}//${host}`;
}

export default async function PayoutsReturnPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer || !organizer.stripeAccountId) {
    redirect("/dashboard/onboarding/payouts");
  }

  const account = await reconcileAccount(organizer.stripeAccountId);
  const complete =
    Boolean(account.details_submitted) &&
    Boolean(account.charges_enabled) &&
    Boolean(account.payouts_enabled);
  if (complete) redirect("/dashboard");

  async function resume() {
    "use server";
    if (!organizer?.stripeAccountId) return;
    const o = origin();
    const link = await refreshOnboardingLink({
      accountId: organizer.stripeAccountId,
      returnUrl: `${o}/dashboard/onboarding/payouts/return`,
      refreshUrl: `${o}/dashboard/onboarding/payouts`,
    });
    redirect(link.url);
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-4">
      <h1 className="text-xl font-bold sm:text-2xl">Jeszcze chwila</h1>
      <p className="text-muted-foreground">Stripe potrzebuje dodatkowych informacji, aby aktywować wypłaty.</p>
      <form action={resume}>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
        >
          Kontynuuj w Stripe
        </button>
      </form>
      <p><Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground">Wróć do panelu</Link></p>
    </div>
  );
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import {
  createConnectAccountAndLink,
  refreshOnboardingLink,
} from "@/lib/stripe-connect";

function rootDomain() {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
}

function origin() {
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  return `${proto}//${rootDomain()}`;
}

export default async function PayoutsOnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  if (
    organizer.stripeOnboardingComplete === 1 &&
    organizer.stripePayoutsEnabled === 1
  ) {
    redirect("/dashboard");
  }

  async function start() {
    "use server";
    if (!organizer) return;
    const o = origin();
    const returnUrl = `${o}/dashboard/onboarding/payouts/return`;
    const refreshUrl = `${o}/dashboard/onboarding/payouts`;

    if (organizer.stripeAccountId) {
      const link = await refreshOnboardingLink({
        accountId: organizer.stripeAccountId,
        returnUrl,
        refreshUrl,
      });
      redirect(link.url);
    } else {
      const link = await createConnectAccountAndLink({
        organizerId: organizer.id,
        organizerEmail: organizer.contactEmail,
        returnUrl,
        refreshUrl,
      });
      redirect(link.url);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Skonfiguruj wypłaty</h1>
      <p>
        Aby publikować wydarzenia i przyjmować płatności, połącz konto Stripe.
        Wypłaty na Twoje konto bankowe uruchamiasz ręcznie, kiedy tego chcesz.
      </p>
      <form action={start}>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-neutral-800"
        >
          Połącz Stripe
        </button>
      </form>
    </div>
  );
}

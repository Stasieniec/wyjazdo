import { getStripe } from "@/lib/stripe";

export async function fetchConnectBalance(accountId: string) {
  const stripe = getStripe();
  return stripe.balance.retrieve(undefined, { stripeAccount: accountId });
}

export async function fetchRecentPayouts(accountId: string, limit = 10) {
  const stripe = getStripe();
  const res = await stripe.payouts.list({ limit }, { stripeAccount: accountId });
  return res.data;
}

export async function createManualPayout(params: {
  accountId: string;
  amountMinorUnits: number;
  currency: string;
}) {
  const stripe = getStripe();
  return stripe.payouts.create(
    { amount: params.amountMinorUnits, currency: params.currency },
    { stripeAccount: params.accountId },
  );
}

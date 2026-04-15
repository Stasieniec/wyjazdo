import { getStripe } from "@/lib/stripe";
import {
  setOrganizerStripeAccountId,
  syncOrganizerStripeState,
} from "@/lib/db/queries/organizers";
import type Stripe from "stripe";

export async function createConnectAccountAndLink(params: {
  organizerId: string;
  organizerEmail: string | null;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string; accountId: string }> {
  const stripe = getStripe();

  const account = await stripe.accounts.create({
    type: "express",
    country: "PL",
    email: params.organizerEmail ?? undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
      blik_payments: { requested: true },
      p24_payments: { requested: true },
    },
    settings: { payouts: { schedule: { interval: "manual" } } },
    metadata: { organizer_id: params.organizerId },
  });

  await setOrganizerStripeAccountId(params.organizerId, account.id);

  const link = await stripe.accountLinks.create({
    account: account.id,
    type: "account_onboarding",
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
  });

  return { url: link.url, accountId: account.id };
}

export async function refreshOnboardingLink(params: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: params.accountId,
    type: "account_onboarding",
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
  });
  return { url: link.url };
}

export async function reconcileAccount(accountId: string): Promise<Stripe.Account> {
  const stripe = getStripe();
  const a = await stripe.accounts.retrieve(accountId);
  await syncOrganizerStripeState({
    accountId: a.id,
    onboardingComplete: Boolean(a.details_submitted) && Boolean(a.charges_enabled),
    payoutsEnabled: Boolean(a.payouts_enabled),
  });
  return a;
}

export async function createExpressLoginLink(accountId: string): Promise<{ url: string }> {
  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(accountId);
  return { url: link.url };
}

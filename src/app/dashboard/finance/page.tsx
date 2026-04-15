import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import {
  getFinanceSummary,
  getRevenueByEvent,
  getRecentPayments,
} from "@/lib/db/queries/finance";
import { fetchConnectBalance, fetchRecentPayouts } from "@/lib/stripe-finance";
import { payoutAvailableAction, openExpressDashboardAction } from "./actions";
import { Card } from "@/components/ui";

function formatPln(cents: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPlnDetailed(cents: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(cents / 100);
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function FinancePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  const [summary, byEvent, recentPayments] = await Promise.all([
    getFinanceSummary(organizer.id),
    getRevenueByEvent(organizer.id),
    getRecentPayments(organizer.id, 20),
  ]);

  // Connect balance/payouts — only fetched when Stripe onboarding is complete
  let connectData:
    | { balance: Awaited<ReturnType<typeof fetchConnectBalance>>; payouts: Awaited<ReturnType<typeof fetchRecentPayouts>> }
    | null = null;
  let connectError = false;

  if (organizer.stripeAccountId && organizer.stripeOnboardingComplete === 1) {
    try {
      const [balance, payouts] = await Promise.all([
        fetchConnectBalance(organizer.stripeAccountId),
        fetchRecentPayouts(organizer.stripeAccountId),
      ]);
      connectData = { balance, payouts };
    } catch {
      connectError = true;
    }
  }

  const hasAnyRevenue = summary.paidCount > 0 || summary.refundedCount > 0;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finanse</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Podsumowanie płatności ze wszystkich Twoich wydarzeń.
        </p>
      </div>

      {/* Stripe Connect — Wypłaty */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Wypłaty Stripe</h2>

        {!organizer.stripeAccountId || organizer.stripeOnboardingComplete !== 1 ? (
          <Card className="mt-4" padding="lg">
            <p className="text-sm text-muted-foreground">
              Aby zarządzać wypłatami, dokończ konfigurację Stripe.{" "}
              <Link href="/dashboard/settings/stripe" className="text-primary underline underline-offset-2">
                Skonfiguruj teraz
              </Link>
            </p>
          </Card>
        ) : connectError ? (
          <Card className="mt-4 border-destructive/40 bg-destructive/5" padding="lg">
            <p className="text-sm text-destructive">
              Nie udało się załadować salda Stripe. Spróbuj później.
            </p>
          </Card>
        ) : connectData ? (
          <div className="mt-4 space-y-4">
            {/* Balance cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Dostępne saldo
                </p>
                {connectData.balance.available.length === 0 ? (
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">0 zł</p>
                ) : (
                  connectData.balance.available.map((b) => (
                    <p key={b.currency} className="mt-2 text-2xl font-bold tabular-nums text-primary">
                      {(b.amount / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {b.currency.toUpperCase()}
                    </p>
                  ))
                )}
                <p className="mt-1 text-xs text-muted-foreground">gotowe do wypłaty</p>
              </Card>
              <Card>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Saldo oczekujące
                </p>
                {connectData.balance.pending.length === 0 ? (
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">0 zł</p>
                ) : (
                  connectData.balance.pending.map((b) => (
                    <p key={b.currency} className="mt-2 text-2xl font-bold tabular-nums text-foreground">
                      {(b.amount / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {b.currency.toUpperCase()}
                    </p>
                  ))
                )}
                <p className="mt-1 text-xs text-muted-foreground">rozliczane przez Stripe</p>
              </Card>
            </div>

            {/* Payout form — only show if there's PLN available */}
            {(() => {
              const plnAvailable = connectData.balance.available.find(
                (b) => b.currency.toLowerCase() === "pln",
              );
              if (!plnAvailable || plnAvailable.amount <= 0) return null;
              return (
                <form action={payoutAvailableAction}>
                  <input type="hidden" name="amountMinor" value={plnAvailable.amount} />
                  <input type="hidden" name="currency" value="pln" />
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    Wypłać {(plnAvailable.amount / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                  </button>
                </form>
              );
            })()}

            {/* Recent payouts table */}
            {connectData.payouts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Ostatnie wypłaty</h3>
                <Card padding="none" className="mt-2 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 font-medium">ID</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">Kwota</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {connectData.payouts.map((p) => (
                        <tr key={p.id}>
                          <td className="truncate px-4 py-3 font-mono text-xs text-muted-foreground max-w-[10rem]">
                            {p.id}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {(p.amount / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency.toUpperCase()}
                          </td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">{p.status}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {new Date(p.created * 1000).toLocaleDateString("pl-PL", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}

            {/* Express dashboard link */}
            <form action={openExpressDashboardAction}>
              <button
                type="submit"
                className="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Otwórz panel Stripe Express
              </button>
            </form>
          </div>
        ) : null}
      </section>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Łączny przychód"
          value={formatPln(summary.totalRevenueCents)}
          hint={`${summary.paidCount} ${summary.paidCount === 1 ? "płatność" : "płatności"}`}
          accent
        />
        <StatCard
          label="Opłaceni uczestnicy"
          value={String(summary.paidCount)}
          hint="w sumie"
        />
        <StatCard
          label="Zwroty"
          value={summary.refundedCount > 0 ? formatPln(summary.refundedCents) : "—"}
          hint={
            summary.refundedCount > 0
              ? `${summary.refundedCount} ${summary.refundedCount === 1 ? "zwrot" : "zwroty"}`
              : "brak zwrotów"
          }
        />
      </div>

      {!hasAnyRevenue ? (
        <Card className="mt-8 text-center" padding="lg">
          <h2 className="text-lg font-semibold text-foreground">
            Jeszcze nie masz żadnych płatności
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Kiedy pierwszy uczestnik opłaci zapis na Twoje wydarzenie, zobaczysz tu
            pełne podsumowanie przychodów.
          </p>
        </Card>
      ) : (
        <>
          {/* Per-event breakdown */}
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Przychód wg wydarzeń</h2>
            <Card padding="none" className="mt-4 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Wydarzenie</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Opłaceni</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Przychód</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byEvent.map((e) => (
                    <tr key={e.eventId}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/events/${e.eventId}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {e.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {e.paidCount}/{e.capacity}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatPlnDetailed(e.revenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          {/* Recent payments */}
          {recentPayments.length > 0 && (
            <section className="mt-10 pb-8">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Ostatnie płatności</h2>
                <span className="text-xs text-muted-foreground">
                  {recentPayments.length >= 20 ? "Ostatnie 20" : `${recentPayments.length} łącznie`}
                </span>
              </div>
              <Card padding="none" className="mt-4 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Data</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Uczestnik</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Wydarzenie</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Kwota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentPayments.map((p) => (
                      <tr key={p.participantId}>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(p.paidAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {p.firstName} {p.lastName}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/events/${p.eventId}`}
                            className="text-muted-foreground hover:underline"
                          >
                            {p.eventTitle}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatPlnDetailed(p.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

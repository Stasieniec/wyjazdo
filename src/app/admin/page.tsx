import { requireAdmin } from "@/lib/admin-auth";
import {
  getOverviewStats,
  getRecentOrganizers,
  getRecentSucceededPayments,
} from "@/lib/db/queries/admin";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentOrganizersList } from "@/components/admin/RecentOrganizersList";
import { RecentPaymentsList } from "@/components/admin/RecentPaymentsList";
import { formatPlnFromCents } from "@/lib/format-currency";

export const metadata = { title: "Przegląd · Wyjazdo Admin" };

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [stats, recentOrgs, recentPays] = await Promise.all([
    getOverviewStats(),
    getRecentOrganizers(10),
    getRecentSucceededPayments(10),
  ]);

  return (
    <>
      <AdminTopBar crumbs={[{ label: "Przegląd" }]} />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Organizatorzy
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Wszyscy">{stats.organizers.total}</StatCard>
            <StatCard label="Nowi (7 dni)">{stats.organizers.new7d}</StatCard>
            <StatCard label="Nowi (30 dni)">{stats.organizers.new30d}</StatCard>
            <StatCard label="Aktywni" subtitle="z opublikowanym wydarzeniem">
              {stats.organizers.active}
            </StatCard>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Wydarzenia
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Wszystkie">{stats.events.total}</StatCard>
            <StatCard label="Nadchodzące" subtitle="opublikowane">
              {stats.events.upcomingPublished}
            </StatCard>
            <StatCard label="Szkice">{stats.events.draft}</StatCard>
            <StatCard label="Opublikowane">{stats.events.published}</StatCard>
            <StatCard label="Zarchiwizowane">{stats.events.archived}</StatCard>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Uczestnicy
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Aktywni razem">{stats.participants.totalActive}</StatCard>
            <StatCard label="Nowi (7 dni)">{stats.participants.new7d}</StatCard>
            <StatCard label="Nowi (30 dni)">{stats.participants.new30d}</StatCard>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Płatności
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Opłacone razem"
              subtitle={`${stats.payments.succeededAllCount} szt.`}
              variant="navy"
            >
              {formatPlnFromCents(stats.payments.succeededAllSumCents)}
            </StatCard>
            <StatCard
              label="Opłacone (30 dni)"
              subtitle={`${stats.payments.succeeded30dCount} szt.`}
            >
              {formatPlnFromCents(stats.payments.succeeded30dSumCents)}
            </StatCard>
            <StatCard
              label="Opłacone (7 dni)"
              subtitle={`${stats.payments.succeeded7dCount} szt.`}
            >
              {formatPlnFromCents(stats.payments.succeeded7dSumCents)}
            </StatCard>
            <StatCard label="Oczekujące">{stats.payments.pendingCount}</StatCard>
            <StatCard label="Nieudane">{stats.payments.failedCount}</StatCard>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ostatni organizatorzy
            </h2>
            <RecentOrganizersList rows={recentOrgs} />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ostatnie wpłaty
            </h2>
            <RecentPaymentsList rows={recentPays} />
          </section>
        </div>
      </main>
    </>
  );
}

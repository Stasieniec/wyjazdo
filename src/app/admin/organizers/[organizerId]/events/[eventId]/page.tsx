import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getEventDetail } from "@/lib/db/queries/admin";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  AdminTable,
  AdminThead,
  AdminTh,
  AdminTbody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { AdminParticipantRow } from "@/components/admin/AdminParticipantRow";
import { formatPlnFromCents } from "@/lib/format-currency";

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
function formatDateTime(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ organizerId: string; eventId: string }>;
}) {
  await requireAdmin();
  const { organizerId, eventId } = await params;
  const detail = await getEventDetail(eventId);
  if (!detail || detail.organizer.id !== organizerId) notFound();

  const e = detail.event;

  return (
    <>
      <AdminTopBar
        crumbs={[
          { label: "Organizatorzy", href: "/admin/organizers" },
          {
            label: detail.organizer.displayName,
            href: `/admin/organizers/${detail.organizer.id}`,
          },
          { label: e.title },
        ]}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-xl border border-border bg-background p-5">
          <h1 className="mb-3 text-2xl font-bold text-primary">{e.title}</h1>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <Detail label="Slug">{e.slug}</Detail>
            <Detail label="Status">{e.status}</Detail>
            <Detail label="Start">{formatDateTime(e.startsAt)}</Detail>
            <Detail label="Koniec">{formatDateTime(e.endsAt)}</Detail>
            <Detail label="Lokalizacja">{e.location ?? "—"}</Detail>
            <Detail label="Pojemność">{e.capacity}</Detail>
            <Detail label="Cena">{formatPlnFromCents(e.priceCents)}</Detail>
            <Detail label="Zaliczka">
              {e.depositCents != null ? formatPlnFromCents(e.depositCents) : "—"}
            </Detail>
            <Detail label="Termin reszty">{formatDate(e.balanceDueAt)}</Detail>
            <Detail label="Waluta">{e.currency}</Detail>
            <Detail label="Opublikowane">{formatDateTime(e.publishedAt)}</Detail>
            <Detail label="Utworzone">{formatDateTime(e.createdAt)}</Detail>
          </dl>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Podsumowanie
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <StatCard label="Zapisani">{detail.aggregates.registered}</StatCard>
            <StatCard label="Lista rezerwowa">{detail.aggregates.waitlisted}</StatCard>
            <StatCard label="Anulowani">{detail.aggregates.cancelled}</StatCard>
            <StatCard label="Aktywni uczestnicy">{detail.aggregates.activeAttendees}</StatCard>
            <StatCard label="Opłacone" variant="navy">
              {formatPlnFromCents(detail.aggregates.succeededSumCents)}
            </StatCard>
            <StatCard label="Oczekujące">
              {formatPlnFromCents(detail.aggregates.pendingSumCents)}
            </StatCard>
            <StatCard label="Zwrócone">
              {formatPlnFromCents(detail.aggregates.refundedSumCents)}
            </StatCard>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Uczestnicy ({detail.participants.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Imię / email</span>
              <span>Status</span>
              <span>Osoby</span>
              <span>Opłacone</span>
              <span>Brakuje</span>
              <span>Zapisany</span>
            </div>
            {detail.participants.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Brak uczestników.
              </div>
            ) : (
              detail.participants.map((p) => <AdminParticipantRow key={p.id} p={p} />)
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Wszystkie płatności ({detail.payments.length})
          </h2>
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>Uczestnik</AdminTh>
                <AdminTh>Typ</AdminTh>
                <AdminTh className="text-right">Kwota</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Opłacono</AdminTh>
                <AdminTh>Termin</AdminTh>
                <AdminTh>Stripe session</AdminTh>
                <AdminTh>Stripe PI</AdminTh>
              </tr>
            </AdminThead>
            <AdminTbody>
              {detail.payments.length === 0 ? (
                <AdminTr>
                  <AdminTd className="py-4 text-center text-muted-foreground">
                    Brak płatności.
                  </AdminTd>
                </AdminTr>
              ) : (
                detail.payments.map((pay) => (
                  <AdminTr key={pay.id}>
                    <AdminTd>
                      <div className="font-medium">{pay.participantName}</div>
                      <div className="text-xs text-muted-foreground">
                        {pay.participantEmail}
                      </div>
                    </AdminTd>
                    <AdminTd className="text-xs">{pay.kind}</AdminTd>
                    <AdminTd className="text-right tabular-nums">
                      {formatPlnFromCents(pay.amountCents)}
                    </AdminTd>
                    <AdminTd className="text-xs">{pay.status}</AdminTd>
                    <AdminTd className="text-xs text-muted-foreground">
                      {formatDateTime(pay.paidAt)}
                    </AdminTd>
                    <AdminTd className="text-xs text-muted-foreground">
                      {formatDateTime(pay.dueAt)}
                    </AdminTd>
                    <AdminTd className="font-mono text-[10px] text-muted-foreground">
                      {pay.stripeSessionId ?? "—"}
                    </AdminTd>
                    <AdminTd className="font-mono text-[10px] text-muted-foreground">
                      {pay.stripePaymentIntentId ?? "—"}
                    </AdminTd>
                  </AdminTr>
                ))
              )}
            </AdminTbody>
          </AdminTable>
        </section>
      </main>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </>
  );
}

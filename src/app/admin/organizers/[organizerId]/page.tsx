import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrganizerDetail } from "@/lib/db/queries/admin";
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
import { formatPlnFromCents } from "@/lib/format-currency";

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";

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

export default async function OrganizerDetailPage({
  params,
}: {
  params: Promise<{ organizerId: string }>;
}) {
  await requireAdmin();
  const { organizerId } = await params;
  const detail = await getOrganizerDetail(organizerId);
  if (!detail) notFound();

  const o = detail.organizer;
  const socialLinks: Record<string, string> = o.socialLinks
    ? safeParseJsonRecord(o.socialLinks)
    : {};

  return (
    <>
      <AdminTopBar
        crumbs={[
          { label: "Organizatorzy", href: "/admin/organizers" },
          { label: o.displayName },
        ]}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="grid gap-6 rounded-xl border border-border bg-background p-5 md:grid-cols-[120px_1fr]">
          <div className="flex flex-col items-start gap-2">
            {o.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.logoUrl}
                alt={o.displayName}
                className="h-24 w-24 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-border text-3xl font-bold text-muted-foreground">
                {o.displayName.charAt(0)}
              </div>
            )}
            {o.brandColor ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="inline-block h-4 w-4 rounded border border-border"
                  style={{ backgroundColor: o.brandColor }}
                />
                {o.brandColor}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-primary">{o.displayName}</h1>
            {o.description ? (
              <p className="text-sm text-muted-foreground">{o.description}</p>
            ) : null}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <Detail label="Subdomena">
                <a
                  href={`https://${o.subdomain}.${rootDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {o.subdomain}.{rootDomain}
                </a>
              </Detail>
              <Detail label="Email">{o.contactEmail ?? "—"}</Detail>
              <Detail label="Telefon">{o.contactPhone ?? "—"}</Detail>
              <Detail label="Utworzony">{formatDateTime(o.createdAt)}</Detail>
              <Detail label="Zaktualizowany">{formatDateTime(o.updatedAt)}</Detail>
              <Detail label="Regulamin zaakceptowany">
                {formatDateTime(o.termsAcceptedAt)}
              </Detail>
              <Detail label="DPA zaakceptowana">{formatDateTime(o.dpaAcceptedAt)}</Detail>
              <Detail label="Stripe account">{o.stripeAccountId ?? "—"}</Detail>
              <Detail label="Stripe onboarding">
                {o.stripeOnboardingComplete ? "✓ Zakończony" : "✗ Niezakończony"}
              </Detail>
              <Detail label="Stripe payouts">
                {o.stripePayoutsEnabled ? "✓ Włączone" : "✗ Wyłączone"}
              </Detail>
              <Detail label="Stripe ostatnia synchronizacja">
                {formatDateTime(o.stripeAccountSyncedAt)}
              </Detail>
            </dl>
            {Object.keys(socialLinks).length > 0 ? (
              <div className="pt-2 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Social
                </div>
                <ul className="mt-1 flex flex-wrap gap-3">
                  {Object.entries(socialLinks).map(([k, v]) => (
                    <li key={k}>
                      <a
                        href={v}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {k}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Podsumowanie
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Aktywni uczestnicy">{detail.stats.activeParticipants}</StatCard>
            <StatCard label="Przychód">
              {formatPlnFromCents(detail.stats.revenueCents)}
            </StatCard>
            <StatCard label="Szkice">{detail.stats.eventsByStatus.draft}</StatCard>
            <StatCard label="Opublikowane">{detail.stats.eventsByStatus.published}</StatCard>
            <StatCard label="Zarchiwizowane">{detail.stats.eventsByStatus.archived}</StatCard>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Wydarzenia ({detail.events.length})
          </h2>
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>Tytuł</AdminTh>
                <AdminTh>Start</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh className="text-right">Pojemność</AdminTh>
                <AdminTh className="text-right">Zapisani</AdminTh>
                <AdminTh className="text-right">Przychód</AdminTh>
                <AdminTh>Utworzone</AdminTh>
              </tr>
            </AdminThead>
            <AdminTbody>
              {detail.events.length === 0 ? (
                <AdminTr>
                  <AdminTd className="py-4 text-center text-muted-foreground">
                    Brak wydarzeń.
                  </AdminTd>
                </AdminTr>
              ) : (
                detail.events.map((e) => (
                  <AdminTr key={e.id}>
                    <AdminTd>
                      <Link
                        href={`/admin/organizers/${organizerId}/events/${e.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {e.title}
                      </Link>
                    </AdminTd>
                    <AdminTd className="text-xs text-muted-foreground">
                      {formatDate(e.startsAt)}
                    </AdminTd>
                    <AdminTd className="text-xs">{e.status}</AdminTd>
                    <AdminTd className="text-right tabular-nums">{e.capacity}</AdminTd>
                    <AdminTd className="text-right tabular-nums">
                      {e.registeredCount}
                    </AdminTd>
                    <AdminTd className="text-right tabular-nums">
                      {formatPlnFromCents(e.revenueCents)}
                    </AdminTd>
                    <AdminTd className="text-xs text-muted-foreground">
                      {formatDate(e.createdAt)}
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

function safeParseJsonRecord(s: string): Record<string, string> {
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {}
  return {};
}

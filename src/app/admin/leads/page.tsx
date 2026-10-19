import { requireAdmin } from "@/lib/admin-auth";
import { listLeads } from "@/lib/db/queries/leads";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  AdminTable,
  AdminThead,
  AdminTh,
  AdminTbody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";

export const metadata = { title: "Prośby o kontakt · Wyjazdo Admin" };

const LIMIT = 200;

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminLeadsPage() {
  await requireAdmin();
  const rows = await listLeads(LIMIT);

  return (
    <>
      <AdminTopBar crumbs={[{ label: "Prośby o kontakt" }]} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-sm text-muted-foreground">
          Zgłoszenia z przycisku „Poproś o kontakt” na stronie głównej, najnowsze pierwsze
          {rows.length === LIMIT ? ` (pokazuję ${LIMIT} ostatnich)` : ""}.
        </p>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-background px-4 py-6 text-sm text-muted-foreground">
            Na razie nikt nie zostawił kontaktu.
          </p>
        ) : (
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>Kiedy</AdminTh>
                <AdminTh>Kontakt</AdminTh>
                <AdminTh>Imię</AdminTh>
                <AdminTh>Obsłużone</AdminTh>
                <AdminTh>IP</AdminTh>
              </tr>
            </AdminThead>
            <AdminTbody>
              {rows.map((l) => {
                const isEmail = l.contact.includes("@");
                return (
                  <AdminTr key={l.id}>
                    <AdminTd className="whitespace-nowrap">{formatDateTime(l.createdAt)}</AdminTd>
                    <AdminTd>
                      <a
                        href={isEmail ? `mailto:${l.contact}` : `tel:${l.contact}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {l.contact}
                      </a>
                    </AdminTd>
                    <AdminTd>{l.name ?? <span className="text-muted-foreground">nie podano</span>}</AdminTd>
                    <AdminTd className="whitespace-nowrap">
                      {l.handledAt ? formatDateTime(l.handledAt) : <span className="text-muted-foreground">nie</span>}
                    </AdminTd>
                    <AdminTd className="text-xs text-muted-foreground">
                      <span title={l.userAgent ?? undefined}>{l.ip ?? "brak"}</span>
                    </AdminTd>
                  </AdminTr>
                );
              })}
            </AdminTbody>
          </AdminTable>
        )}
      </main>
    </>
  );
}

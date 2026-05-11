import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import {
  listOrganizers,
  type OrganizerListSort,
  type SortDir,
} from "@/lib/db/queries/admin";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  AdminTable,
  AdminThead,
  AdminTh,
  AdminTbody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";
import { AdminSortHeader } from "@/components/admin/AdminSortHeader";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchForm } from "@/components/admin/AdminSearchForm";
import { formatPlnFromCents } from "@/lib/format-currency";

const PAGE_SIZE = 50;
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";

export const metadata = { title: "Organizatorzy · Wyjazdo Admin" };

function parseSort(s: string | undefined): OrganizerListSort {
  switch (s) {
    case "displayName":
    case "events":
    case "participants":
    case "revenue":
    case "created":
      return s;
    default:
      return "created";
  }
}
function parseDir(d: string | undefined): SortDir {
  return d === "asc" ? "asc" : "desc";
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function OrganizersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = parseSort(sp.sort);
  const dir = parseDir(sp.dir);

  const { rows, totalCount } = await listOrganizers({
    q,
    page,
    pageSize: PAGE_SIZE,
    sort,
    dir,
  });

  const baseQuery = new URLSearchParams();
  if (q) baseQuery.set("q", q);
  baseQuery.set("sort", sort);
  baseQuery.set("dir", dir);

  const buildSortHref = (newSort: string, newDir: SortDir) => {
    const p = new URLSearchParams(baseQuery);
    p.set("sort", newSort);
    p.set("dir", newDir);
    p.delete("page");
    return `/admin/organizers?${p.toString()}`;
  };
  const buildPageHref = (newPage: number) => {
    const p = new URLSearchParams(baseQuery);
    p.set("page", String(newPage));
    return `/admin/organizers?${p.toString()}`;
  };

  return (
    <>
      <AdminTopBar crumbs={[{ label: "Organizatorzy" }]} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <AdminSearchForm action="/admin/organizers" defaultValue={q ?? ""} />

        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>
                <AdminSortHeader
                  label="Organizator"
                  field="displayName"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
              <AdminTh>Subdomena</AdminTh>
              <AdminTh>Email</AdminTh>
              <AdminTh className="text-right">
                <AdminSortHeader
                  label="Wydarzenia"
                  field="events"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
              <AdminTh className="text-right">
                <AdminSortHeader
                  label="Uczestnicy"
                  field="participants"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
              <AdminTh className="text-right">
                <AdminSortHeader
                  label="Przychód"
                  field="revenue"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
              <AdminTh>Stripe</AdminTh>
              <AdminTh>
                <AdminSortHeader
                  label="Utworzony"
                  field="created"
                  currentSort={sort}
                  currentDir={dir}
                  buildHref={buildSortHref}
                />
              </AdminTh>
            </tr>
          </AdminThead>
          <AdminTbody>
            {rows.length === 0 ? (
              <AdminTr>
                <AdminTd className="py-4 text-center text-muted-foreground">
                  Brak wyników.
                </AdminTd>
              </AdminTr>
            ) : (
              rows.map((r) => (
                <AdminTr key={r.id}>
                  <AdminTd>
                    <Link
                      href={`/admin/organizers/${r.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.displayName}
                    </Link>
                  </AdminTd>
                  <AdminTd>
                    <a
                      href={`https://${r.subdomain}.${rootDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {r.subdomain}
                    </a>
                  </AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">
                    {r.contactEmail ?? "—"}
                  </AdminTd>
                  <AdminTd className="text-right tabular-nums">{r.eventCount}</AdminTd>
                  <AdminTd className="text-right tabular-nums">{r.participantCount}</AdminTd>
                  <AdminTd className="text-right tabular-nums">
                    {formatPlnFromCents(r.revenueCents)}
                  </AdminTd>
                  <AdminTd>{r.stripeOnboardingComplete ? "✓" : "✗"}</AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </AdminTd>
                </AdminTr>
              ))
            )}
          </AdminTbody>
        </AdminTable>

        <AdminPagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          buildHref={buildPageHref}
        />
      </main>
    </>
  );
}

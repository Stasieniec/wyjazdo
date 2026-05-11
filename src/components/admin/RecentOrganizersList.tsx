import Link from "next/link";
import type { RecentOrganizer } from "@/lib/db/queries/admin";

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function RecentOrganizersList({ rows }: { rows: RecentOrganizer[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak organizatorów.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-background">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between p-3 text-sm">
          <div className="min-w-0">
            <Link
              href={`/admin/organizers/${r.id}`}
              className="font-medium text-primary hover:underline"
            >
              {r.displayName}
            </Link>
            <div className="text-xs text-muted-foreground">
              <a
                href={`https://${r.subdomain}.${rootDomain}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {r.subdomain}.{rootDomain}
              </a>
              {r.contactEmail ? ` · ${r.contactEmail}` : null}
            </div>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span>{r.stripeOnboardingComplete ? "Stripe ✓" : "Stripe ✗"}</span>
            <span>{formatDate(r.createdAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

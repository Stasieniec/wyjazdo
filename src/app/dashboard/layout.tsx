import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { UserMenu } from "@/components/dashboard/UserMenu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const organizer = userId ? await getOrganizerByClerkUserId(userId) : null;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";
  const publicUrl = organizer
    ? `https://${organizer.subdomain}.${rootDomain}`
    : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 shadow-sm supports-[backdrop-filter]:backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-6">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-primary transition-opacity hover:opacity-90"
            >
              <WyjazdoMark className="h-8 w-8 shrink-0" />
              wyjazdo
            </Link>
            <DashboardNav />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {publicUrl && (
              <>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/30 p-2 text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground sm:hidden"
                  aria-label={`Strona publiczna: ${organizer!.subdomain}.${rootDomain}`}
                  title={`${organizer!.subdomain}.${rootDomain}`}
                >
                  <PublicSiteIcon />
                </a>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden max-w-[min(100%,14rem)] truncate rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground sm:inline-flex"
                >
                  {organizer!.subdomain}.{rootDomain}{" "}
                  <span aria-hidden>↗</span>
                </a>
              </>
            )}
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

function PublicSiteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M6.194 12.753a.75.75 0 001.06.053L16 5.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-8.53 8.197a.75.75 0 00-.053 1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
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
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-6">
            <Link
              href="/dashboard"
              className="shrink-0 text-lg font-bold tracking-tight text-primary"
            >
              wyjazdo
            </Link>
            <details className="group relative sm:hidden">
              <summary className="flex cursor-pointer list-none items-center rounded-md border border-border px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span className="sr-only">Menu</span>
                <span aria-hidden className="text-base leading-none">
                  &#9776;
                </span>
              </summary>
              <nav className="absolute left-0 top-full z-50 mt-1 flex min-w-[12rem] flex-col gap-0.5 rounded-md border border-border bg-background p-2 text-sm shadow-md">
                <NavLink href="/dashboard">Wydarzenia</NavLink>
                <NavLink href="/dashboard/finance">Finanse</NavLink>
                <NavLink href="/dashboard/settings">Ustawienia</NavLink>
              </nav>
            </details>
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              <NavLink href="/dashboard">Wydarzenia</NavLink>
              <NavLink href="/dashboard/finance">Finanse</NavLink>
              <NavLink href="/dashboard/settings">Ustawienia</NavLink>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {publicUrl && (
              <>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
                  aria-label={`Strona publiczna: ${organizer!.subdomain}.${rootDomain}`}
                  title={`${organizer!.subdomain}.${rootDomain}`}
                >
                  <PublicSiteIcon />
                </a>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden max-w-[min(100%,14rem)] truncate rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
                >
                  {organizer!.subdomain}.{rootDomain} &nearr;
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
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

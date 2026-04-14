import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";

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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-lg font-bold tracking-tight text-primary"
            >
              wyjazdo
            </Link>
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              <NavLink href="/dashboard">Wydarzenia</NavLink>
              <NavLink href="/dashboard/settings">Ustawienia</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                {organizer!.subdomain}.{rootDomain} &nearr;
              </a>
            )}
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
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

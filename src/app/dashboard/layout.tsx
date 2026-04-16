import { auth } from "@clerk/nextjs/server";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileTabBar } from "@/components/dashboard/MobileTabBar";
import { UserMenu } from "@/components/dashboard/UserMenu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const organizer = userId ? await getOrganizerByClerkUserId(userId) : null;

  const userName = organizer?.displayName ?? "Organizator";
  const userEmail = organizer?.contactEmail ?? "";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userInitial={userInitial}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Minimal top bar for desktop (user menu + public site link) */}
        <header className="hidden sm:flex items-center justify-end gap-3 border-b border-border bg-background/95 px-6 py-3 supports-[backdrop-filter]:backdrop-blur-md">
          {organizer && (
            <a
              href={`https://${organizer.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[14rem] truncate rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {organizer.subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl"}{" "}
              <span aria-hidden>↗</span>
            </a>
          )}
          <UserMenu />
        </header>

        {/* Mobile header */}
        <header className="flex sm:hidden items-center justify-between border-b border-border bg-background px-4 py-3">
          <span className="text-base font-bold tracking-tight text-primary">Wyjazdo</span>
          <UserMenu />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 pb-20 sm:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar />
    </div>
  );
}

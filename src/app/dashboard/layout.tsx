import { auth } from "@clerk/nextjs/server";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileTabBar } from "@/components/dashboard/MobileTabBar";
import { UserMenu } from "@/components/dashboard/UserMenu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const organizer = userId ? await getOrganizerByClerkUserId(userId) : null;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";

  const publicUrl = organizer
    ? `https://${organizer.subdomain}.${rootDomain}`
    : null;
  const publicLabel = organizer
    ? `${organizer.subdomain}.${rootDomain}`
    : null;

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <Sidebar publicUrl={publicUrl} publicLabel={publicLabel} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
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

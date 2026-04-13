import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold">wyjazdo.pl</Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard">Wydarzenia</Link>
            <Link href="/dashboard/settings">Ustawienia</Link>
            <UserButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

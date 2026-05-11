import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { IBM_Plex_Serif } from "next/font/google";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";
import { UserMenu } from "@/components/dashboard/UserMenu";

const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ibm-plex-serif",
  display: "swap",
});

export default function PomocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen bg-background ${ibmPlexSerif.variable}`}>
      <nav className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-primary"
          >
            <WyjazdoMark className="h-8 w-8 shrink-0" />
            wyjazdo
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/pomoc"
              className="font-medium text-foreground"
              aria-current="true"
            >
              Pomoc
            </Link>
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Zaloguj się
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
              >
                Wypróbuj za darmo
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
              >
                Panel organizatora
              </Link>
              <UserMenu />
            </Show>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="border-t border-border bg-white px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <Link
            href="/"
            className="font-medium transition-colors hover:text-foreground"
          >
            ← Wróć do strony głównej
          </Link>
          <a
            href="mailto:kontakt@wyjazdo.pl"
            className="transition-colors hover:text-foreground"
          >
            Masz pytanie? kontakt@wyjazdo.pl
          </a>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { siteOrigin } from "@/lib/urls";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Wyjazdo",
  alternateName: "wyjazdo.pl",
  url: siteOrigin(),
  description:
    "Platforma dla organizatorów wyjazdów, retreatów i warsztatów — zapisy, płatności online i panel uczestników.",
  inLanguage: "pl-PL",
  publisher: {
    "@type": "Organization",
    name: "Wyjazdo",
    url: siteOrigin(),
    logo: `${siteOrigin()}/logo.png`,
  },
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-primary"
          >
            <WyjazdoMark className="h-8 w-8 shrink-0" />
            wyjazdo
          </Link>
          <Show when="signed-out">
            <div className="flex items-center gap-3 text-sm">
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
            </div>
          </Show>
          <Show when="signed-in">
            <div className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
              >
                Panel organizatora
              </Link>
              <UserMenu />
            </div>
          </Show>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 pt-16 pb-4 sm:pt-24 sm:pb-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
            Dla organizatorów wyjazdów grupowych
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Organizujesz wyjazdy?
            <br />
            <span className="text-accent">My ogarniamy resztę.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Zapisy, płatności, uczestnicy — jedno narzędzie zamiast dziesięciu
            arkuszy.
          </p>
          <div className="mt-8">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="inline-flex items-center rounded-xl bg-accent px-8 py-4 text-base font-semibold text-white shadow-[--shadow-warm] transition-all hover:bg-accent/90"
              >
                Zacznij za darmo →
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-xl bg-accent px-8 py-4 text-base font-semibold text-white shadow-[--shadow-warm] transition-all hover:bg-accent/90"
              >
                Przejdź do panelu →
              </Link>
            </Show>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Bez karty kredytowej · Gotowe w 5 minut
          </p>
        </div>
      </section>

      {/* ── Dashboard screenshot ── */}
      <section className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-primary p-2 shadow-[--shadow-navy] sm:p-3">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-2 pb-2">
              <div className="h-2 w-2 rounded-full bg-white/30" />
              <div className="h-2 w-2 rounded-full bg-white/30" />
              <div className="h-2 w-2 rounded-full bg-white/30" />
              <div className="ml-3 flex-1 rounded-md bg-white/10 px-3 py-1">
                <span className="text-[10px] text-white/40 sm:text-xs">
                  app.wyjazdo.pl/dashboard
                </span>
              </div>
            </div>
            {/* Dashboard mockup content */}
            <div className="rounded-xl bg-[#FAFAFA] p-3 sm:p-4">
              <div className="flex gap-3">
                {/* Mini sidebar */}
                <div className="hidden sm:flex w-36 shrink-0 flex-col rounded-xl bg-primary p-3">
                  <div className="flex items-center gap-1.5 pb-4">
                    <div className="h-4 w-4 rounded bg-accent" />
                    <div className="h-1.5 w-12 rounded bg-white/60" />
                  </div>
                  <div className="mb-2 rounded-lg bg-white/12 border-l-2 border-accent px-2 py-1.5">
                    <div className="h-1 w-14 rounded bg-white/60" />
                  </div>
                  <div className="mb-2 px-2 py-1.5">
                    <div className="h-1 w-16 rounded bg-white/25" />
                  </div>
                  <div className="mb-2 px-2 py-1.5">
                    <div className="h-1 w-12 rounded bg-white/25" />
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="h-1 w-14 rounded bg-white/25" />
                  </div>
                </div>
                {/* Mini content */}
                <div className="flex-1 space-y-3">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-gradient-to-br from-primary to-[#2d5a8a] p-2.5 text-white">
                      <div className="h-1 w-10 rounded bg-white/40 mb-1.5" />
                      <div className="h-3 w-14 rounded bg-white/80" />
                    </div>
                    <div className="rounded-lg border border-border bg-white p-2.5">
                      <div className="h-1 w-10 rounded bg-border mb-1.5" />
                      <div className="h-3 w-6 rounded bg-primary/70" />
                    </div>
                    <div className="rounded-lg border border-border bg-white p-2.5">
                      <div className="h-1 w-12 rounded bg-border mb-1.5" />
                      <div className="h-2 w-16 rounded bg-foreground/60" />
                    </div>
                  </div>
                  {/* Action items */}
                  <div className="rounded-lg border border-border bg-white p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <div className="h-1 w-24 rounded bg-foreground/30" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <div className="h-1 w-28 rounded bg-foreground/30" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success" />
                      <div className="h-1 w-20 rounded bg-foreground/30" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust line ── */}
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Już ponad{" "}
          <strong className="font-semibold text-primary">200 wyjazdów</strong>{" "}
          zorganizowanych z Wyjazdo
        </p>
      </div>

      {/* ── Benefits ── */}
      <section className="px-6 py-12 sm:py-16">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 10h18" />
                <path d="M9 4v6" />
              </svg>
            }
            title="Formularz zapisów"
            description="Uczestnicy zapisują się sami. Ty dostajesz powiadomienie."
          />
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
                <path d="M6 15h4" />
              </svg>
            }
            title="Automatyczne płatności"
            description="Linki do płatności wysyłają się same. Koniec z pilnowaniem przelewów."
          />
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3.5" />
                <path d="M2 21c0-4.418 3.134-8 7-8s7 3.582 7 8" />
                <path d="M16 3.5c1.657 0 3 1.567 3 3.5s-1.343 3.5-3 3.5" />
                <path d="M19 14c2.21 1.333 3.5 3.667 3.5 7" />
              </svg>
            }
            title="Pełen obraz"
            description="Kto zapłacił, kto nie, kto czeka — wszystko w jednym widoku."
          />
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <QuoteIcon className="mx-auto mb-6 h-8 w-8 text-accent/30" />
          <blockquote>
            <p className="text-xl font-medium leading-relaxed text-foreground sm:text-2xl">
              Wyjazdo oszczędza mi godziny każdego miesiąca. Jeden link
              i&nbsp;uczestnicy sami się zapisują i&nbsp;płacą — bez żadnych
              telefonów ani&nbsp;maili.
            </p>
            <footer className="mt-6">
              <div className="font-semibold text-foreground">Marta Kowalska</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Organizatorka retreatów jogi, Kraków
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="relative overflow-hidden bg-primary px-6 py-20 sm:py-24">
        {/* Dot texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Coral glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] translate-x-1/3 -translate-y-1/4 rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Gotowa, żeby uprościć organizację?
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Załóż konto w&nbsp;minutę. Bez opłat startowych, bez karty.
          </p>
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center rounded-xl bg-accent px-8 py-4 font-semibold text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent/90"
            >
              Zacznij za darmo
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="mt-8 inline-flex items-center rounded-xl bg-accent px-8 py-4 font-semibold text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent/90"
            >
              Przejdź do panelu
            </Link>
          </Show>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-white px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <WyjazdoMark className="h-6 w-6" />
              wyjazdo.pl
            </Link>
            <nav className="flex gap-6 text-xs text-muted-foreground">
              <Link
                href="/regulamin"
                className="transition-colors hover:text-foreground"
              >
                Regulamin
              </Link>
              <Link
                href="/polityka-prywatnosci"
                className="transition-colors hover:text-foreground"
              >
                Polityka prywatności
              </Link>
              <a
                href="mailto:kontakt@wyjazdo.pl"
                className="transition-colors hover:text-foreground"
              >
                Kontakt
              </a>
            </nav>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} wyjazdo.pl
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent sm:mx-0">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M0 16.571C0 10.187 3.738 5.155 11.214 1.472L13.333 4.8C9.124 7.04 6.857 9.813 6.476 13.12H10.667V24H0V16.571ZM18.667 16.571C18.667 10.187 22.405 5.155 29.881 1.472L32 4.8C27.791 7.04 25.524 9.813 25.143 13.12H29.333V24H18.667V16.571Z" />
    </svg>
  );
}

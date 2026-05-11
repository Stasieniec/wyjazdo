import Image from "next/image";
import Link from "next/link";
import { IBM_Plex_Serif } from "next/font/google";
import { Show } from "@clerk/nextjs";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { siteOrigin } from "@/lib/urls";

const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ibm-plex-serif",
  display: "swap",
});

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
    <div className={`min-h-screen bg-background ${ibmPlexSerif.variable}`}>
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
                href="/pomoc"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Pomoc
              </Link>
              <Link
                href="/sign-in"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Zaloguj się
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_6px_16px_rgba(30,58,95,0.25)] active:scale-[0.97]"
              >
                Wypróbuj za darmo
              </Link>
            </div>
          </Show>
          <Show when="signed-in">
            <div className="flex items-center gap-4 text-sm">
              <Link
                href="/pomoc"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Pomoc
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_6px_16px_rgba(30,58,95,0.25)] active:scale-[0.97]"
              >
                Panel organizatora
              </Link>
              <UserMenu />
            </div>
          </Show>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#FAF1E2]">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-1/3 h-[420px] w-[420px] rounded-full bg-accent/10 blur-3xl"
        />

        {/* Two-column area */}
        <div className="relative lg:min-h-[calc(100vh-3.5rem-72px)]">
          <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-6 pt-14 pb-12 lg:min-h-[calc(100vh-3.5rem-72px)] lg:py-16 lg:pr-[44rem]">
            <SmallLeaf className="mb-4 h-7 w-14 text-accent/70" />

            <h1 className="font-[family-name:var(--font-ibm-plex-serif)] text-[2.75rem] font-medium leading-[1.02] tracking-[-0.02em] text-primary sm:text-6xl lg:text-[5.25rem]">
              Mniej chaosu,
              <br />
              <span className="text-accent">więcej czasu</span>
              <br />
              <span>na&nbsp;Twój wyjazd</span>
            </h1>

            <p className="mt-7 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              Wyjazdo pomaga ogarnąć zapisy, płatności i&nbsp;kontakt
              z&nbsp;uczestniczkami — bez arkuszy i&nbsp;stresu.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Show when="signed-out">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center rounded-xl bg-accent px-7 py-4 text-base font-semibold text-white shadow-[--shadow-warm] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_8px_24px_rgba(232,104,58,0.4)] active:translate-y-0 active:scale-[0.98]"
                >
                  Zobacz, jak to działa →
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center rounded-xl border border-primary/15 bg-white px-7 py-4 text-base font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white hover:shadow-[0_8px_24px_rgba(30,58,95,0.12)] active:translate-y-0 active:scale-[0.98]"
                >
                  Zaloguj się
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center rounded-xl bg-accent px-7 py-4 text-base font-semibold text-white shadow-[--shadow-warm] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_8px_24px_rgba(232,104,58,0.4)] active:translate-y-0 active:scale-[0.98]"
                >
                  Zobacz, jak to działa →
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center rounded-xl border border-primary/15 bg-white px-7 py-4 text-base font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white hover:shadow-[0_8px_24px_rgba(30,58,95,0.12)] active:translate-y-0 active:scale-[0.98]"
                >
                  Przejdź do panelu
                </Link>
              </Show>
            </div>

            {/* Trust line */}
            <div className="mt-12 flex items-center gap-4">
              <div className="flex -space-x-2">
                <AvatarChip className="bg-[#E8D5BA]" initials="A" />
                <AvatarChip className="bg-[#E5C9C2]" initials="M" />
                <AvatarChip className="bg-[#CDCEBE]" initials="J" />
                <AvatarChip className="bg-[#E8D5BA]" initials="E" />
              </div>
              <p className="text-sm leading-snug text-muted-foreground">
                Zaufane przez organizatorki
                <br />
                kameralnych wyjazdów
              </p>
            </div>
          </div>

          {/* Desktop image — bleeds to viewport right edge */}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 lg:block">
            <div className="relative h-full">
              <div
                className="absolute inset-y-8 left-8 right-0 bg-primary/5 drop-shadow-[0_30px_40px_rgba(30,58,95,0.35)]"
                style={{
                  clipPath:
                    "polygon(34% 0%, 26% 2%, 19% 5%, 13% 9%, 8% 15%, 5% 22%, 3% 30%, 2% 39%, 3% 48%, 4% 56%, 3% 65%, 2% 74%, 4% 82%, 9% 90%, 15% 96%, 22% 100%, 100% 100%, 100% 0%)",
                }}
              >
                <Image
                  src="/hero_image.png"
                  alt="Organizatorki przy stole z herbatą"
                  fill
                  priority
                  sizes="50vw"
                  className="object-cover"
                  style={{ objectPosition: "55% center" }}
                />
              </div>

              <FloatingCard className="pointer-events-auto absolute right-10 top-[10%] w-[220px]">
                <CardHeader icon={<UserIcon className="h-3.5 w-3.5" />} label="Zapisy" />
                <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-3xl font-semibold text-primary">24</span>
                  <span className="text-base text-muted-foreground/70">/ 30</span>
                </div>
                <p className="text-xs text-muted-foreground">miejsc zajętych</p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[80%] rounded-full bg-accent" />
                </div>
              </FloatingCard>

              <FloatingCard className="pointer-events-auto absolute right-2 top-[36%] w-[240px]">
                <CardHeader icon={<WalletIcon className="h-3.5 w-3.5" />} label="Płatności" />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="space-y-0.5 text-sm">
                    <p>
                      <span className="font-semibold text-success">14</span>{" "}
                      <span className="text-muted-foreground">opłaconych</span>
                    </p>
                    <p>
                      <span className="font-semibold text-accent">10</span>{" "}
                      <span className="text-muted-foreground">oczekuje</span>
                    </p>
                  </div>
                  <DonutChart filled={0.58} />
                </div>
              </FloatingCard>

              <FloatingCard className="pointer-events-auto absolute right-10 top-[60%] w-[240px]">
                <CardHeader icon={<UsersIcon className="h-3.5 w-3.5" />} label="Uczestniczki" />
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <AvatarChip className="bg-[#E8D5BA]" initials="A" small />
                    <AvatarChip className="bg-[#E5C9C2]" initials="M" small />
                    <AvatarChip className="bg-[#CDCEBE]" initials="J" small />
                    <AvatarChip className="bg-[#E8D5BA]" initials="E" small />
                    <AvatarChip className="bg-[#E5C9C2]" initials="K" small />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">+8</span>
                </div>
                <p className="mt-2 text-xs font-medium text-primary">Zobacz wszystkie →</p>
              </FloatingCard>

              <div className="pointer-events-auto absolute bottom-12 right-16 w-[300px] rounded-2xl border border-primary/5 bg-white px-4 py-3 shadow-[0_20px_50px_-20px_rgba(30,58,95,0.3)]">
                <div className="flex items-start gap-3">
                  <AvatarChip className="bg-[#E5C9C2]" initials="K" />
                  <div className="flex-1">
                    <p className="font-[family-name:var(--font-ibm-plex-serif)] text-sm italic font-medium leading-snug text-foreground">
                      „Wreszcie mam wszystko
                      <br />w&nbsp;jednym miejscu"
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Kasia, organizatorka wyjazdów
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile image — stacked */}
          <div className="px-6 pb-10 lg:hidden">
            <div className="relative mx-auto aspect-[5/6] w-full max-w-[480px] overflow-hidden rounded-[44%_24px_24px_44%/52%_24px_24px_52%] shadow-[0_25px_60px_-25px_rgba(30,58,95,0.4)]">
              <Image
                src="/hero_image.png"
                alt="Organizatorki przy stole z herbatą"
                fill
                priority
                sizes="100vw"
                className="object-cover"
                style={{ objectPosition: "55% center" }}
              />
            </div>
          </div>
        </div>

        <SectionWave fill="white" />

        {/* Bottom feature strip */}
        <div className="relative bg-white px-6 py-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-around gap-y-3 gap-x-8 text-sm text-foreground">
            <FeaturePill
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 10h18" />
                  <path d="M9 4v6" />
                </svg>
              }
              text="Zapisy bez arkuszy"
            />
            <FeaturePill
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              }
              text="Płatności pod kontrolą"
            />
            <FeaturePill
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
              text="Kontakt w jednym miejscu"
            />
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="relative bg-white px-6 pt-12 pb-0">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-center text-base text-muted-foreground">
          <SmallLeaf className="hidden h-6 w-16 -scale-x-100 text-accent/55 sm:block" />
          <p>
            Już ponad{" "}
            <span className="font-[family-name:var(--font-ibm-plex-serif)] text-xl italic font-semibold text-primary">
              200&nbsp;wyjazdów
            </span>{" "}
            zorganizowanych z&nbsp;Wyjazdo
          </p>
          <SmallLeaf className="hidden h-6 w-16 text-accent/55 sm:block" />
        </div>
        <SectionWave fill="#FAF1E2" />
      </section>

      {/* ── Benefits ── */}
      <section className="relative overflow-hidden bg-[#FAF1E2] px-6 py-20 sm:py-24">
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <SmallLeaf className="mx-auto mb-3 h-6 w-16 text-accent/60" />
            <h2 className="font-[family-name:var(--font-ibm-plex-serif)] text-3xl font-medium tracking-[-0.015em] text-primary sm:text-4xl">
              Wszystko, czego potrzebujesz —{" "}
              <span className="italic text-accent">w&nbsp;jednym miejscu</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
              Trzy rzeczy, które zabierają najwięcej czasu — załatwiamy je za&nbsp;Ciebie.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <BenefitCard
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 10h18" />
                  <path d="M9 4v6" />
                </svg>
              }
              title="Formularz zapisów"
              description="Uczestniczki zapisują się same. Ty dostajesz powiadomienie."
            />
            <BenefitCard
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                  <path d="M6 15h4" />
                </svg>
              }
              title="Automatyczne płatności"
              description="Linki wysyłają się same. Koniec z&nbsp;pilnowaniem przelewów."
            />
            <BenefitCard
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="3.5" />
                  <path d="M2 21c0-4.418 3.134-8 7-8s7 3.582 7 8" />
                  <path d="M16 3.5c1.657 0 3 1.567 3 3.5s-1.343 3.5-3 3.5" />
                  <path d="M19 14c2.21 1.333 3.5 3.667 3.5 7" />
                </svg>
              }
              title="Pełen obraz"
              description="Kto zapłacił, kto nie, kto czeka — wszystko w&nbsp;jednym widoku."
            />
          </div>
        </div>
        <SectionWave fill="white" />
      </section>

      {/* ── Testimonial ── */}
      <section className="relative overflow-hidden bg-white px-6 py-20 sm:py-24">
        <div className="relative mx-auto max-w-2xl text-center">
          <HandQuoteMark className="mx-auto mb-6 h-12 w-12 text-accent/45" />
          <blockquote>
            <p className="font-[family-name:var(--font-ibm-plex-serif)] text-2xl italic leading-relaxed text-foreground sm:text-[1.7rem]">
              Wyjazdo oszczędza mi godziny każdego miesiąca. Jeden link
              i&nbsp;uczestniczki same się zapisują i&nbsp;płacą — bez żadnych
              telefonów ani&nbsp;maili.
            </p>
            <footer className="mt-8 flex items-center justify-center gap-3">
              <AvatarChip className="bg-[#E5C9C2]" initials="MK" />
              <div className="text-left">
                <div className="font-semibold text-foreground">Marta Kowalska</div>
                <div className="text-sm text-muted-foreground">
                  Organizatorka retreatów jogi, Kraków
                </div>
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="relative overflow-hidden bg-primary px-6 py-20 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] translate-x-1/3 -translate-y-1/4 rounded-full bg-accent/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-2xl text-center">
          <SmallLeaf className="mx-auto mb-3 h-6 w-16 text-accent/70" />
          <h2 className="font-[family-name:var(--font-ibm-plex-serif)] text-3xl font-medium tracking-[-0.015em] text-white sm:text-4xl">
            Gotowa, żeby{" "}
            <span className="italic text-accent">uprościć</span> organizację?
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Załóż konto w&nbsp;minutę. Bez opłat startowych, bez karty.
          </p>
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center rounded-xl bg-accent px-8 py-4 font-semibold text-white shadow-lg shadow-accent/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_12px_32px_rgba(232,104,58,0.5)] active:translate-y-0 active:scale-[0.98]"
            >
              Zacznij za darmo →
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="mt-8 inline-flex items-center rounded-xl bg-accent px-8 py-4 font-semibold text-white shadow-lg shadow-accent/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_12px_32px_rgba(232,104,58,0.5)] active:translate-y-0 active:scale-[0.98]"
            >
              Przejdź do panelu →
            </Link>
          </Show>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-white px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <WyjazdoMark className="h-6 w-6" />
              wyjazdo.pl
            </Link>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <Link
                href="/regulamin"
                className="transition-colors hover:text-foreground"
              >
                Regulamin
              </Link>
              <Link
                href="/organizer-terms"
                className="transition-colors hover:text-foreground"
              >
                Regulamin organizatorów
              </Link>
              <Link
                href="/polityka-prywatnosci"
                className="transition-colors hover:text-foreground"
              >
                Polityka prywatności
              </Link>
              <Link
                href="/cookies"
                className="transition-colors hover:text-foreground"
              >
                Cookies
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
          <div className="border-t border-border/60 pt-5 text-center text-xs leading-relaxed text-muted-foreground sm:text-left">
            <p>
              Wyjazdo to platforma prowadzona przez{" "}
              <span className="font-semibold text-foreground">
                Narrative Impact Jacek Wasilewski
              </span>
              , ul. Krechowiecka 5 lok. 11, 01-635 Warszawa, NIP PL 5221330690.
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
    <div className="relative rounded-2xl border border-primary/5 bg-white/70 p-6 shadow-[0_15px_40px_-30px_rgba(30,58,95,0.4)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/10 hover:shadow-[0_25px_55px_-25px_rgba(30,58,95,0.55)]">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/12 text-accent">
        {icon}
      </div>
      <h3 className="font-[family-name:var(--font-ibm-plex-serif)] text-xl font-semibold text-primary">
        {title}
      </h3>
      <p
        className="mt-3 text-sm leading-relaxed text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: description }}
      />
    </div>
  );
}

// ── Hero / shared helpers ─────────────────────

function FloatingCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-primary/5 bg-white px-4 py-3 shadow-[0_20px_50px_-20px_rgba(30,58,95,0.3)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/12 text-accent">
        {icon}
      </span>
      {label}
    </div>
  );
}

function AvatarChip({
  className,
  initials,
  small,
}: {
  className?: string;
  initials: string;
  small?: boolean;
}) {
  const size = small ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <span
      className={`${size} inline-flex items-center justify-center rounded-full font-semibold text-primary/75 ring-2 ring-white ${className ?? ""}`}
    >
      {initials}
    </span>
  );
}

function DonutChart({ filled }: { filled: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - filled);
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 36 36"
      aria-hidden
      className="shrink-0 -rotate-90"
    >
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function FeaturePill({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/12 text-accent">
        {icon}
      </span>
      <span className="font-medium text-foreground">{text}</span>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M16 13h2" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.866 3.134-7 7-7s7 3.134 7 7" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M22 18c0-2.761-2.239-5-5-5" />
    </svg>
  );
}

function SmallLeaf({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M 4 26 C 22 14, 50 10, 76 14" />
      <path d="M 22 19 C 23 9, 32 8, 35 16 C 30 19, 24 21, 22 19 Z" />
      <path d="M 44 13 C 45 3, 54 2, 57 10 C 52 13, 46 15, 44 13 Z" />
      <path d="M 62 11 C 63 1, 72 0, 75 8 C 70 11, 64 13, 62 11 Z" />
    </svg>
  );
}

function SectionWave({ fill }: { fill: string }) {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className="-mb-px block h-12 w-full sm:h-16 md:h-20"
      aria-hidden
    >
      <path
        fill={fill}
        d="M 0,42 C 220,82 460,8 720,38 C 980,62 1220,14 1440,40 L 1440,80 L 0,80 Z"
      />
      <path
        d="M 0,42 C 220,82 460,8 720,38 C 980,62 1220,14 1440,40"
        fill="none"
        stroke="rgba(232,104,58,0.22)"
        strokeWidth="1.25"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function HandQuoteMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 30 C 8 30, 6 24, 8 18 C 10 12, 16 10, 20 12" />
      <path d="M14 30 C 14 24, 12 22, 10 22" />
      <path d="M34 30 C 28 30, 26 24, 28 18 C 30 12, 36 10, 40 12" />
      <path d="M34 30 C 34 24, 32 22, 30 22" />
    </svg>
  );
}

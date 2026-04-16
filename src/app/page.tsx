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
            className="flex items-center gap-2 font-semibold tracking-tight text-primary"
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
                className="rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90"
              >
                Załóż konto
              </Link>
            </div>
          </Show>
          <Show when="signed-in">
            <div className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90"
              >
                Panel organizatora
              </Link>
              <UserMenu />
            </div>
          </Show>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-primary">
        {/* Dot-grid texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Soft coral accent glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] translate-x-1/2 -translate-y-1/4 rounded-full bg-accent/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-5xl px-6 pb-28 pt-20 sm:pb-36 sm:pt-28">
          {/* Badge pill */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm text-white/75">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            Dla organizatorów wyjazdów, retreatów i&nbsp;warsztatów
          </div>

          {/* Headline */}
          <h1 className="max-w-2xl text-5xl font-bold leading-[1.07] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Zapisy, płatności
            <br />
            <span className="text-accent">i&nbsp;uczestnicy</span>
            <br />
            w&nbsp;jednym miejscu.
          </h1>

          {/* Sub-copy */}
          <p className="mt-7 max-w-lg text-lg leading-relaxed text-white/65">
            Koniec z&nbsp;rozrzuconymi formularzami, arkuszami
            i&nbsp;ręcznym pilnowaniem przelewów. Wyjazdo daje Ci własną
            stronę i&nbsp;profesjonalne narzędzia do prowadzenia zapisów.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="rounded-lg bg-accent px-7 py-3.5 font-semibold text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent/90 hover:shadow-accent/40"
              >
                Zacznij za darmo
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border border-white/20 bg-white/10 px-7 py-3.5 font-medium text-white/90 transition-all hover:border-white/30 hover:bg-white/15"
              >
                Zaloguj się
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg bg-accent px-7 py-3.5 font-semibold text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent/90"
              >
                Przejdź do panelu
              </Link>
            </Show>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            {[
              "BLIK i Przelewy24",
              "Własna subdomena",
              "Wypłaty na konto",
              "Darmowy start",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── How it works ── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
              Jak to działa?
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Trzy kroki do pierwszego zapisu
            </h2>
          </div>

          <div className="relative grid gap-10 sm:grid-cols-3 sm:gap-6">
            {/* Connector line — sits behind the number circles */}
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-5 hidden h-px bg-border sm:block"
            />
            <Step
              number="01"
              title="Stwórz profil"
              description="Załóż konto, wybierz subdomenę i uzupełnij profil organizatora. Twoja strona jest od razu dostępna."
            />
            <Step
              number="02"
              title="Dodaj wydarzenie"
              description="Opisz wyjazd, ustaw datę, cenę i liczbę miejsc. Dodaj pytania do formularza zapisu."
            />
            <Step
              number="03"
              title="Zbieraj zapisy"
              description="Uczestnicy zapisują się i płacą online — BLIK, Przelewy24 lub kartą. Ty widzisz wszystko w panelu."
            />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-y border-border bg-[#F6F8FA] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
              Funkcje
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Wszystko, czego potrzebujesz
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Jeden zestaw narzędzi zamiast pięciu różnych aplikacji.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Feature
              icon={<GlobeIcon />}
              title="Własna subdomena"
              description="Twój profil i wydarzenia pod adresem twoja-nazwa.wyjazdo.pl — gotowy w minutę, bez żadnej techniki."
            />
            <Feature
              icon={<CreditCardIcon />}
              title="Płatności online"
              description="BLIK, Przelewy24, karty — uczestnicy płacą od razu przy zapisie, pieniądze trafiają prosto na Twoje konto."
            />
            <Feature
              icon={<ClipboardIcon />}
              title="Formularz zapisu"
              description="Zbieraj dane uczestników i dodatkowe pytania — dieta, rozmiar koszulki, poziom zaawansowania."
            />
            <Feature
              icon={<UsersIcon />}
              title="Limit miejsc i waitlista"
              description="Ustaw maksymalną liczbę uczestników — po zapełnieniu automatycznie rusza lista rezerwowa."
            />
            <Feature
              icon={<LayoutIcon />}
              title="Panel organizatora"
              description="Lista uczestników, statusy płatności, eksport CSV — wszystko w jednym miejscu, dostępne o każdej porze."
            />
            <Feature
              icon={<CalendarIcon />}
              title="Strona wydarzenia"
              description="Każde wydarzenie ma własną stronę z opisem, datą i ceną — gotową do udostępnienia w social mediach."
            />
          </div>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <QuoteIcon className="mx-auto mb-8 h-8 w-8 text-accent/40" />
          <blockquote>
            <p className="text-xl font-medium leading-relaxed text-foreground sm:text-2xl">
              Wyjazdo oszczędza mi godziny każdego miesiąca. Jeden link
              i&nbsp;uczestnicy sami się zapisują i&nbsp;płacą — bez żadnych
              telefonów ani&nbsp;maili.
            </p>
            <footer className="mt-8">
              <div className="font-semibold text-foreground">Marta Kowalska</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Organizatorka retreatów jogi, Kraków
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="bg-accent px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Gotowy, żeby uprościć organizację?
          </h2>
          <p className="mt-4 text-lg text-white/75">
            Załóż konto w&nbsp;minutę. Bez opłat startowych, bez karty.
          </p>
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className="mt-10 inline-flex items-center rounded-lg bg-white px-8 py-4 font-semibold text-accent shadow-xl shadow-black/20 transition-all hover:bg-white/92"
            >
              Zacznij za darmo
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="mt-10 inline-flex items-center rounded-lg bg-white px-8 py-4 font-semibold text-accent shadow-xl shadow-black/20 transition-all hover:bg-white/92"
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
// Section sub-components
// ─────────────────────────────────────────────

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center px-2 text-center">
      <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-white text-sm font-bold text-primary shadow-sm">
        {number}
      </div>
      <h3 className="mt-5 font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-border bg-white p-6 transition-all hover:border-primary/25 hover:shadow-sm">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary transition-colors group-hover:bg-primary/12">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Icons (20 × 20, stroke-based)
// ─────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 8L6.5 11.5L13 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M0 16.571C0 10.187 3.738 5.155 11.214 1.472L13.333 4.8C9.124 7.04 6.857 9.813 6.476 13.12H10.667V24H0V16.571ZM18.667 16.571C18.667 10.187 22.405 5.155 29.881 1.472L32 4.8C27.791 7.04 25.524 9.813 25.143 13.12H29.333V24H18.667V16.571Z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 1.75C10 1.75 7 5.5 7 10C7 14.5 10 18.25 10 18.25M10 1.75C10 1.75 13 5.5 13 10C13 14.5 10 18.25 10 18.25M10 1.75V18.25M1.75 10H18.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="1.75"
        y="4.75"
        width="16.5"
        height="10.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M1.75 8H18.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 12H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7.5 2.75H5.5C4.948 2.75 4.5 3.198 4.5 3.75V16.25C4.5 16.802 4.948 17.25 5.5 17.25H14.5C15.052 17.25 15.5 16.802 15.5 16.25V3.75C15.5 3.198 15.052 2.75 14.5 2.75H12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.5 2.75C7.5 2.198 7.948 1.75 8.5 1.75H11.5C12.052 1.75 12.5 2.198 12.5 2.75V3.75H7.5V2.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7.5 9H12.5M7.5 12H11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="7.5" cy="6" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2 17C2 13.686 4.462 11 7.5 11C10.538 11 13 13.686 13 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13.5 5.5C14.881 5.5 16 6.619 16 8C16 9.381 14.881 10.5 13.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M15.5 17C15.5 14.8 14.248 12.9 12.5 12.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="16"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M2 7H18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7 7V18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="3.5"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M2 8.5H18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M6.5 2V5M13.5 2V5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="13" r="1" fill="currentColor" />
      <circle cx="10" cy="13" r="1" fill="currentColor" />
      <circle cx="13" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

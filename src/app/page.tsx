import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="text-lg font-bold tracking-tight text-primary">
          wyjazdo
        </span>
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
              className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Załóż konto
            </Link>
          </div>
        </Show>
        <Show when="signed-in">
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/dashboard"
              className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Panel organizatora
            </Link>
            <UserButton />
          </div>
        </Show>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pt-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Zapisy, płatności i&nbsp;uczestnicy
            <br />
            <span className="text-accent">w&nbsp;jednym miejscu.</span>
          </h1>
          <p className="mt-6 max-w-prose text-lg leading-relaxed text-muted-foreground">
            Wyjazdo to platforma dla organizatorów wyjazdów, retreatów
            i&nbsp;warsztatów. Koniec z&nbsp;rozrzuconymi formularzami,
            arkuszami i&nbsp;ręcznym pilnowaniem przelewów.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="rounded-lg bg-accent px-6 py-3 font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
              >
                Zacznij za darmo
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border border-border px-6 py-3 font-medium text-foreground transition-colors hover:bg-muted"
              >
                Zaloguj się
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg bg-accent px-6 py-3 font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
              >
                Przejdź do panelu
              </Link>
            </Show>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
            Jak to działa?
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <Step
              number="1"
              title="Stwórz profil"
              description="Załóż konto, wybierz subdomenę i uzupełnij profil organizatora. Twoja strona jest od razu dostępna."
            />
            <Step
              number="2"
              title="Dodaj wydarzenie"
              description="Opisz wyjazd, ustaw datę, cenę i liczbę miejsc. Dodaj pytania do formularza zapisu."
            />
            <Step
              number="3"
              title="Zbieraj zapisy"
              description="Uczestnicy zapisują się i płacą online — BLIK, Przelewy24 lub kartą. Ty widzisz wszystko w panelu."
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
            Wszystko, czego potrzebujesz
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              title="Własna subdomena"
              description="Twój profil i wydarzenia pod adresem twoja-nazwa.wyjazdo.pl"
            />
            <Feature
              title="Płatności online"
              description="BLIK, Przelewy24, karty — uczestnicy płacą od razu przy zapisie"
            />
            <Feature
              title="Formularz zapisu"
              description="Zbieraj dane uczestników i dodatkowe pytania (dieta, rozmiar koszulki, itp.)"
            />
            <Feature
              title="Limit miejsc i waitlista"
              description="Ustaw maksymalną liczbę uczestników — po zapełnieniu rusza lista rezerwowa"
            />
            <Feature
              title="Panel organizatora"
              description="Lista uczestników, statusy płatności, eksport CSV — wszystko w jednym miejscu"
            />
            <Feature
              title="Strona wydarzenia"
              description="Każde wydarzenie ma własną stronę, którą możesz udostępniać"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            Gotowy, żeby uprościć organizację?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Załóż konto w minutę i stwórz swoje pierwsze wydarzenie.
          </p>
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className="mt-8 inline-flex rounded-lg bg-accent px-8 py-3.5 font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Zacznij za darmo
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="mt-8 inline-flex rounded-lg bg-accent px-8 py-3.5 font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Przejdź do panelu
            </Link>
          </Show>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto max-w-5xl text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} wyjazdo.pl
        </div>
      </footer>
    </div>
  );
}

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
    <div className="text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {number}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border p-6">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

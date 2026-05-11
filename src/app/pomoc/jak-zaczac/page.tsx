import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "jak-zaczac";
const TITLE = "Jak zacząć — konto i Twoja strona";
const DESCRIPTION =
  "Załóż konto w Wyjazdo, wybierz adres swojej strony i przygotuj wszystko do pierwszego wydarzenia — w pięć minut.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "jak założyć konto wyjazdo",
    "subdomena wyjazdo",
    "pierwsze logowanie wyjazdo",
    "rejestracja organizatora",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
      >
        <p>
          Założenie konta zajmuje kilka minut. W tym przewodniku
          przeprowadzę Cię przez każdy krok — od kliknięcia
          <em> „Wypróbuj za darmo”</em> do pierwszego logowania w panelu.
        </p>

        <h2>Krok 1. Załóż konto</h2>
        <p>
          Wejdź na <a href="https://wyjazdo.pl">wyjazdo.pl</a> i kliknij
          <em> „Wypróbuj za darmo”</em>. Podaj swój e-mail i ustaw hasło.
          Na podany adres przyjdzie wiadomość — kliknij w nią, żeby
          potwierdzić konto.
        </p>

        <Callout>
          Użyj adresu, do którego masz codzienny dostęp. Na ten sam adres
          przyjdą później powiadomienia o nowych zapisach i o wpływie pieniędzy.
        </Callout>

        <h2>Krok 2. Wybierz adres swojej strony</h2>
        <p>
          Po pierwszym logowaniu Wyjazdo poprosi Cię o wybranie <strong>subdomeny</strong>{" "}
          — czyli krótkiego adresu Twojej strony. Na przykład:{" "}
          <em>kasia.wyjazdo.pl</em>, <em>retreat-mazury.wyjazdo.pl</em> albo{" "}
          <em>warsztaty-anna.wyjazdo.pl</em>.
        </p>
        <p>
          Wybierz coś krótkiego i łatwego do zapamiętania. Na tym adresie
          uczestniczki znajdą wszystkie Twoje wydarzenia. Subdomena nie da
          się później prosto zmienić — pomyśl chwilę, zanim klikniesz <em>„Zapisz”</em>.
        </p>

        <h2>Krok 3. Powiedz nam, kim jesteś</h2>
        <p>
          Wyjazdo zapyta Cię o imię i nazwisko organizatorki oraz o krótki
          opis (kilka zdań o Tobie i o tym, co organizujesz). To pojawi się
          na Twojej stronie — uczestniczki zobaczą, kto je zaprasza.
        </p>

        <h2>Krok 4. Skonfiguruj płatności</h2>
        <p>
          Żeby przyjmować płatności online, musisz raz przejść przez
          konfigurację <strong>Stripe</strong> — to nasz operator płatności.
          Stripe poprosi Cię o dane firmowe (NIP, numer konta) i potwierdzenie
          tożsamości. Wszystko dzieje się na bezpiecznych stronach Stripe.
        </p>
        <p>
          Możesz pominąć ten krok i wrócić do niego później — ale dopóki nie
          dokończysz konfiguracji, nie opublikujesz wydarzenia płatnego.
        </p>
        <p>
          Więcej szczegółów:{" "}
          <Link href="/pomoc/platnosci">Płatności online i wypłaty</Link>.
        </p>

        <h2>Krok 5. Stwórz pierwsze wydarzenie</h2>
        <p>
          Gdy konto jest gotowe, w panelu zobaczysz przycisk{" "}
          <em>„+ Nowe wydarzenie”</em>. Klik — i zaczynasz. Krok po kroku
          opisaliśmy to tutaj:{" "}
          <Link href="/pomoc/tworzenie-wydarzenia">
            Tworzenie wydarzenia krok po kroku
          </Link>
          .
        </p>

        <Callout variant="warning" label="Pamiętaj">
          Konto jest bezpłatne — nie pobieramy żadnych opłat za założenie
          ani za korzystanie z Wyjazdo. Operator płatności (Stripe) pobiera
          swoją prowizję od każdej transakcji.{" "}
          <Link href="/pomoc/cennik">Zobacz cennik</Link>.
        </Callout>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}

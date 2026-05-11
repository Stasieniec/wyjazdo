import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "cennik";
const TITLE = "Ile kosztuje Wyjazdo — cennik i prowizje";
const DESCRIPTION =
  "Wyjazdo nie pobiera dziś opłat za korzystanie. Wyjaśniamy, co dolicza operator płatności (Stripe) i kiedy może się to zmienić.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "ile kosztuje wyjazdo",
    "cennik wyjazdo",
    "prowizja wyjazdo",
    "opłaty wyjazdo",
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
          Wyjazdo jest dziś bezpłatne dla organizatorek. Nie pobieramy opłaty
          za założenie konta ani za korzystanie z platformy. Jedyne koszty,
          jakie mogą się pojawić, dotyczą obsługi płatności online.
        </p>

        <h2>Opłaty po stronie Wyjazdo</h2>
        <ul>
          <li>
            <strong>Założenie konta:</strong> bezpłatne.
          </li>
          <li>
            <strong>Korzystanie z panelu organizatorki:</strong> bezpłatne.
          </li>
          <li>
            <strong>Strona z subdomeną</strong> (np. <em>kasia.wyjazdo.pl</em>):
            bezpłatna.
          </li>
          <li>
            <strong>Publikowanie wydarzeń:</strong> bezpłatne, bez limitu liczby.
          </li>
          <li>
            <strong>Automatyczne maile</strong> do uczestniczek (potwierdzenia,
            przypomnienia): bezpłatne.
          </li>
        </ul>

        <h2>Prowizje operatora płatności (Stripe)</h2>
        <p>
          Płatności online obsługuje <strong>Stripe</strong>. Stripe pobiera
          prowizję od każdej transakcji — stawka zależy od metody (BLIK,
          Przelewy24, karta) i jest publikowana przez Stripe. Aktualny cennik
          znajdziesz tutaj:{" "}
          <a
            href="https://stripe.com/pl/pricing"
            target="_blank"
            rel="noopener noreferrer"
          >
            stripe.com/pl/pricing
          </a>
          .
        </p>
        <p>
          Prowizja jest pobierana automatycznie — na Twoje konto bankowe
          wpływa już kwota po jej odjęciu.
        </p>

        <Callout>
          Przykład w uproszczeniu: uczestniczka płaci 500 zł BLIK-iem. Stripe
          potrąca swoją prowizję od tej kwoty. Na Twoje konto trafia różnica
          (np. 493 zł — dokładna kwota zależy od aktualnej stawki Stripe).
        </Callout>

        <h2>Kiedy może się to zmienić</h2>
        <p>
          Zastrzegamy sobie prawo do wprowadzenia opłat za korzystanie z
          Wyjazdo w przyszłości. Jeśli to się stanie, poinformujemy Cię
          mailowo z co najmniej <strong>30-dniowym wyprzedzeniem</strong>{" "}
          — opłaty nigdy nie będą pobierane wstecznie. Tak mówi nasz{" "}
          <Link href="/regulamin">Regulamin</Link>, punkt 4.2.
        </p>

        <h2>Faktury</h2>
        <p>
          Stripe wystawia faktury za swoje prowizje. Znajdziesz je w panelu
          Stripe (logujesz się ze swoich danych, podanych przy konfiguracji).
        </p>

        <p>
          Masz pytanie o konkretną sytuację? Napisz:{" "}
          <a href="mailto:kontakt@wyjazdo.pl">kontakt@wyjazdo.pl</a>.
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}

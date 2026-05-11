import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "platnosci";
const TITLE = "Płatności online i wypłaty";
const DESCRIPTION =
  "Jak działają płatności online w Wyjazdo: BLIK, Przelewy24, karta. Kiedy pieniądze trafiają na Twoje konto i co robić, gdy operator prosi o dokumenty.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "płatności online wyjazdo",
    "blik wyjazdo",
    "przelewy24 wyjazdo",
    "wypłaty wyjazdo",
    "stripe organizator",
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
          Wyjazdo nie obsługuje pieniędzy samodzielnie. Tym zajmuje się{" "}
          <strong>Stripe</strong> — nasz operator płatności (zobaczysz tę
          nazwę na fakturach i na pasku adresu, gdy uczestniczka będzie
          płacić). Stripe trzyma środki bezpiecznie i przelewa je na Twoje
          konto.
        </p>

        <h2>Jakie metody płatności widzą uczestniczki</h2>
        <ul>
          <li>
            <strong>BLIK</strong> — najpopularniejsza metoda w Polsce.
            Uczestniczka wpisuje 6-cyfrowy kod z aplikacji bankowej.
          </li>
          <li>
            <strong>Przelewy24</strong> — przelew bankowy z poziomu strony
            jej banku.
          </li>
          <li>
            <strong>Karta</strong> — Visa, Mastercard, także Apple Pay i
            Google Pay.
          </li>
        </ul>
        <p>
          Nie musisz nic włączać ręcznie — metody płatności pojawiają się
          automatycznie po skonfigurowaniu Stripe.
        </p>

        <h2>Konfiguracja Stripe — co musisz zrobić</h2>
        <p>
          Raz, przed pierwszym płatnym wydarzeniem. Wyjazdo przeprowadzi Cię
          przez to w panelu (kliknij <em>„Skonfiguruj teraz&rdquo;</em> w żółtej
          ramce na <Link href="/dashboard">Przeglądzie</Link>).
        </p>
        <p>Stripe poprosi Cię o:</p>
        <ul>
          <li>Numer NIP (Twojej działalności gospodarczej lub firmy).</li>
          <li>Numer konta bankowego, na które będą wpływać wypłaty.</li>
          <li>Dane do potwierdzenia tożsamości (np. zdjęcie dowodu).</li>
        </ul>
        <p>
          Konfiguracja trwa zwykle 10–15 minut. Stripe weryfikuje dane —
          najczęściej od kilku minut do 1–2 dni roboczych.
        </p>

        <Callout variant="warning" label="Gdy Stripe prosi o dodatkowe dokumenty">
          Czasem Stripe potrzebuje dodatkowych informacji (np. potwierdzenia
          rejestracji firmy). Dostaniesz wtedy maila ze Stripe oraz
          powiadomienie w panelu. Wystarczy zalogować się i dosłać to,
          o co prosi.
        </Callout>

        <h2>Zaliczka i pełna płatność</h2>
        <p>
          Możesz pobrać od uczestniczki całość ceny od razu albo podzielić
          ją na <strong>zaliczkę</strong> i <strong>resztę przed wyjazdem</strong>.
          Drugą opcję ustawiasz w kroku <em>„Płatność&rdquo;</em> kreatora wydarzenia
          — podajesz wysokość zaliczki i datę, do której uczestniczka ma
          dopłacić.
        </p>
        <p>
          Przypomnienie o doliczeniu reszty wysyła się automatycznie. Ty
          widzisz w panelu, kto już dopłacił, a kto jeszcze nie.
        </p>

        <h2>Kiedy pieniądze trafiają na Twoje konto</h2>
        <p>
          Po pomyślnej weryfikacji w Stripe wypłaty na Twoje konto bankowe
          dzieją się automatycznie — zwykle co kilka dni roboczych.
          Dokładny harmonogram zobaczysz w sekcji <em>Finanse</em> w panelu.
        </p>

        <h2>Co dolicza Stripe</h2>
        <p>
          Stripe pobiera swoją prowizję od każdej transakcji. Stawka zależy
          od metody płatności i jest publikowana przez Stripe:{" "}
          <a
            href="https://stripe.com/pl/pricing"
            target="_blank"
            rel="noopener noreferrer"
          >
            stripe.com/pl/pricing
          </a>
          . Prowizja jest odejmowana automatycznie — na konto wpływa już
          pomniejszona kwota.
        </p>

        <h2>Zwroty i anulacje</h2>
        <p>
          Możesz zwrócić uczestniczce pełną kwotę albo część (np. potrącić
          zaliczkę zgodnie ze swoim regulaminem). Zwrot uruchamiasz z poziomu
          listy uczestniczek — opisaliśmy to w{" "}
          <Link href="/pomoc/uczestnicy">Uczestniczki — lista, statusy, zapisy</Link>.
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}

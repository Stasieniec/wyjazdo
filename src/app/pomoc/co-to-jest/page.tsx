import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";

const SLUG = "co-to-jest";
const TITLE = "Co to jest Wyjazdo i jak działa";
const DESCRIPTION =
  "Wyjazdo to narzędzie dla organizatorek wyjazdów, retreatów i warsztatów — w jednym miejscu zbierasz zapisy, przyjmujesz płatności online i prowadzisz listę uczestniczek.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "co to jest wyjazdo",
    "jak działa wyjazdo",
    "platforma dla organizatorów wyjazdów",
    "narzędzie do organizacji retreatów",
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
          <strong>Wyjazdo</strong> to polskie narzędzie dla osób, które
          organizują wyjazdy, retreaty, warsztaty albo kameralne wydarzenia
          dla kobiet. W jednym miejscu zbierasz zapisy, przyjmujesz
          płatności online i prowadzisz listę uczestniczek — bez arkuszy,
          maili z pytaniami i pilnowania przelewów.
        </p>

        <h2>Dla kogo jest Wyjazdo</h2>
        <p>
          Dla organizatorek, które dziś prowadzą zapisy ręcznie: w Google Forms,
          w wiadomościach na Messengerze, w notesie albo w arkuszu kalkulacyjnym.
          Wyjazdo zastępuje to wszystko jedną stroną wydarzenia, którą wysyłasz
          uczestniczkom — same wpisują dane i opłacają zapis online.
        </p>

        <h2>Jak to wygląda w praktyce</h2>
        <ol>
          <li>
            <strong>Zakładasz konto</strong> i wybierasz adres swojej strony —
            na przykład <em>kasia.wyjazdo.pl</em>.
          </li>
          <li>
            <strong>Tworzysz wydarzenie</strong> — wpisujesz tytuł, termin,
            miejsce, cenę i liczbę miejsc. Dodajesz zdjęcia i krótki opis.
          </li>
          <li>
            <strong>Udostępniasz link</strong> uczestniczkom — przez Facebooka,
            Instagrama, maila albo SMS.
          </li>
          <li>
            <strong>Uczestniczki zapisują się same</strong> — wypełniają
            formularz i płacą online (BLIK, Przelewy24 lub karta).
          </li>
          <li>
            <strong>Ty widzisz wszystko w jednym widoku</strong> — kto się
            zapisał, kto zapłacił, kto czeka.
          </li>
          <li>
            <strong>Pieniądze trafiają na Twoje konto</strong> — automatycznie,
            po pomniejszeniu o prowizję operatora płatności.
          </li>
        </ol>

        <h2>Co dostajesz „w pakiecie&rdquo;</h2>
        <ul>
          <li>Własną stronę z adresem <em>twojaSubdomena.wyjazdo.pl</em>.</li>
          <li>Formularz zapisów z polami, które sama wybierasz.</li>
          <li>Płatności online: BLIK, Przelewy24, karta.</li>
          <li>Listę uczestniczek z informacją o statusie płatności.</li>
          <li>Automatyczne maile potwierdzające zapis i płatność.</li>
          <li>Eksport danych do pliku CSV, gdyby kiedyś były potrzebne.</li>
        </ul>

        <h2>Co Wyjazdo Ci oszczędza</h2>
        <p>
          Najbardziej żmudne rzeczy: pisanie maili z potwierdzeniami, pilnowanie,
          kto zapłacił, ręczne przepisywanie danych do tabeli, sprawdzanie
          rachunku bankowego co kilka godzin przed wyjazdem. To wszystko dzieje
          się samo.
        </p>

        <p>
          Jeśli chcesz spróbować —{" "}
          <Link href="/pomoc/jak-zaczac">przejdź do przewodnika „Jak zacząć&rdquo;</Link>.
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "uczestnicy";
const TITLE = "Uczestniczki — lista, statusy, zapisy";
const DESCRIPTION =
  "Jak czytać listę uczestniczek w Wyjazdo, co oznaczają statusy, jak anulować zapis, wyeksportować dane i odpowiedzieć na własne pytania.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "lista uczestników wyjazdo",
    "statusy płatności",
    "anulowanie zapisu",
    "eksport uczestników",
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
          Kiedy ktoś zapisze się na Twoje wydarzenie, dostaniesz powiadomienie
          mailem, a osoba pojawi się na liście uczestniczek. W tym przewodniku
          pokazujemy, jak tę listę czytać i co możesz z nią zrobić.
        </p>

        <h2>Gdzie znajdę listę</h2>
        <p>
          W panelu kliknij <em>Wydarzenia</em>, wybierz wydarzenie, a następnie
          przejdź do zakładki <em>Uczestniczki</em>.
        </p>

        <h2>Co oznaczają statusy</h2>
        <ul>
          <li>
            <strong>Opłacone</strong> — uczestniczka zapłaciła pełną kwotę.
            Wszystko gotowe.
          </li>
          <li>
            <strong>Zaliczka opłacona</strong> — wpłacono zaliczkę, czeka na
            dopłatę reszty.
          </li>
          <li>
            <strong>Oczekuje</strong> — zapis założony, ale jeszcze nie
            opłacony. Czasem to znaczy, że uczestniczka zaczęła płacić i nie
            dokończyła — wraca przez link z maila i kończy.
          </li>
          <li>
            <strong>Anulowane</strong> — zapis anulowany (przez uczestniczkę
            albo przez Ciebie).
          </li>
          <li>
            <strong>Lista oczekujących</strong> — gdy wydarzenie jest pełne,
            kolejne osoby trafiają tutaj.
          </li>
        </ul>

        <h2>Jak działa lista oczekujących</h2>
        <p>
          Gdy ktoś z głównej listy anuluje zapis, pierwsza osoba z listy
          oczekujących dostaje maila z propozycją dołączenia i czasem na
          zapłatę. Jeśli nie skorzysta, propozycja idzie do kolejnej osoby.
        </p>

        <h2>Własne pytania — gdzie zobaczyć odpowiedzi</h2>
        <p>
          Jeśli w kroku <em>„Pytania&rdquo;</em>{" "}
          (<Link href="/pomoc/tworzenie-wydarzenia">w kreatorze wydarzenia</Link>){" "}
          dodałaś własne pytania (np. „Alergie pokarmowe?&rdquo;), odpowiedzi
          uczestniczek znajdziesz w szczegółach każdego zapisu — kliknij
          rząd na liście, żeby otworzyć kartę osoby.
        </p>

        <h2>Anulowanie i zwrot</h2>
        <p>
          Kliknij wiersz uczestniczki i wybierz <em>„Anuluj zapis&rdquo;</em>.
          Wyjazdo zapyta, czy chcesz zwrócić pełną kwotę, część czy nic
          (np. potrącić zaliczkę zgodnie z Twoim regulaminem).
        </p>
        <p>
          Po potwierdzeniu zwrotu pieniądze wracają na konto, z którego
          przyszły. To trwa zwykle od kilku godzin do kilku dni roboczych —
          zależnie od banku uczestniczki.
        </p>

        <Callout variant="warning">
          Po anulowaniu i zwrocie zapisu nie da się go już cofnąć. Jeśli
          uczestniczka chce wrócić, musi zapisać się ponownie.
        </Callout>

        <h2>Eksport do pliku CSV</h2>
        <p>
          Nad listą uczestniczek znajdziesz przycisk <em>„Eksportuj&rdquo;</em>.
          Wyjazdo pobierze plik CSV z imionami, e-mailami, statusami i
          odpowiedziami na Twoje pytania. Plik otwiera się w Excelu, Numbers
          albo Arkuszach Google.
        </p>

        <h2>Komunikacja z uczestniczkami</h2>
        <p>
          Automatyczne maile (potwierdzenie zapisu, potwierdzenie płatności,
          przypomnienie o dopłacie reszty) wysyła Wyjazdo. Jeśli chcesz
          napisać do całej grupy coś własnego — najlepiej skopiuj e-maile
          z eksportu CSV i wyślij wiadomość ze swojej skrzynki.
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}

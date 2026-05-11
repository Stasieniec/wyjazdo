import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "tworzenie-wydarzenia";
const TITLE = "Tworzenie wydarzenia krok po kroku";
const DESCRIPTION =
  "Dziesięć ekranów, jedno wydarzenie. Co podajesz w każdym kroku tworzenia wyjazdu w Wyjazdo i co możesz zmienić później.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "jak stworzyć wydarzenie wyjazdo",
    "kreator wydarzenia wyjazdo",
    "wyjazdo krok po kroku",
    "organizacja wyjazdu online",
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
          Tworzenie wydarzenia w Wyjazdo to dziesięć krótkich ekranów.
          Każdy z nich pyta tylko o jedną rzecz. Możesz przerwać w dowolnym
          momencie — postęp zapisuje się automatycznie i wracasz tam, gdzie
          skończyłaś.
        </p>

        <p>
          Żeby zacząć, w panelu kliknij <em>„+ Nowe wydarzenie”</em>.
        </p>

        <h2>1. Tytuł</h2>
        <p>
          Nazwa wydarzenia, którą zobaczą uczestniczki — na przykład{" "}
          <em>„Retreat jogi w Bieszczadach”</em> albo{" "}
          <em>„Weekend ceramiki, listopad 2026”</em>. Krótko, konkretnie.
          Tytuł trafia także do adresu strony Twojego wydarzenia.
        </p>

        <h2>2. Opis</h2>
        <p>
          Tutaj rozwijasz, czego uczestniczka może się spodziewać. Plan dnia,
          poziom zaawansowania, co warto wziąć ze sobą. Możesz pisać krótkie
          akapity albo dodać listę punktów — wszystko pojawi się na publicznej
          stronie wydarzenia.
        </p>

        <Callout>
          Opis można zmienić w każdej chwili — także po publikacji. Nie musisz
          mieć od razu finalnej wersji.
        </Callout>

        <h2>3. Termin</h2>
        <p>
          Data i godzina rozpoczęcia oraz zakończenia. Jeśli wyjazd trwa
          kilka dni, podaj pierwszy i ostatni dzień. Strefa czasowa jest
          ustawiona na polską (Europa/Warszawa).
        </p>

        <h2>4. Miejsce</h2>
        <p>
          Adres lub nazwa miejsca. Może być ogólne („Bieszczady, ośrodek
          Słoneczne Wzgórze”) albo dokładne („Lutowiska, ul. Bieszczadzka 12”).
          Pojawi się na stronie wydarzenia.
        </p>

        <h2>5. Uczestnicy</h2>
        <p>
          Definiujesz <strong>typy uczestników</strong> — czyli rodzaje
          biletów. Najprościej: jeden typ („Uczestniczka”) z jedną ceną.
          Bardziej rozbudowanie: kilka typów z różnymi cenami (na przykład
          „Dorosły” i „Dziecko”) albo cena malejąca przy większej liczbie osób.
        </p>
        <p>
          Każdy typ ma minimalną i maksymalną liczbę osób w jednym zapisie —
          dzięki temu możesz mieć na przykład <em>„Pakiet rodzinny — od 2 do 5 osób”</em>.
        </p>

        <h2>6. Liczba miejsc</h2>
        <p>
          Ile osób w sumie się zmieści. Gdy zapisze się tyle uczestniczek,
          formularz zapisu zamyka się automatycznie, a kolejne osoby trafiają
          na listę oczekujących.
        </p>

        <h2>7. Płatność</h2>
        <p>
          Ekran widoczny tylko wtedy, gdy Twoje wydarzenie nie jest bezpłatne.
          Tutaj decydujesz:
        </p>
        <ul>
          <li>
            <strong>Pełna kwota od razu</strong> — uczestniczka płaci całość
            podczas zapisu.
          </li>
          <li>
            <strong>Zaliczka teraz, reszta przed wyjazdem</strong> —
            wskazujesz wysokość zaliczki i datę, do której uczestniczka ma
            dopłacić resztę. Przypomnienie wysyła się samo.
          </li>
        </ul>
        <p>
          Szczegóły dotyczące metod płatności i prowizji opisaliśmy w{" "}
          <Link href="/pomoc/platnosci">Płatności online i wypłaty</Link>.
        </p>

        <h2>8. Zdjęcia</h2>
        <p>
          Zdjęcie główne (tzw. <em>cover</em>) plus opcjonalnie kilka zdjęć
          do galerii. Dobre zdjęcie zwiększa liczbę zapisów — pokaż miejsce,
          atmosferę, ludzi.
        </p>

        <h2>9. Pytania</h2>
        <p>
          Własne pytania, które uczestniczki dostaną w formularzu zapisu — na
          przykład <em>„Czy masz alergie pokarmowe?”</em>, <em>„Z jakiego miasta
          przyjeżdżasz?”</em>, <em>„Preferencje co do pokoju”</em>. Możesz wybrać
          typ pola (krótka odpowiedź, długa odpowiedź, wybór z listy) i czy
          pytanie jest obowiązkowe.
        </p>

        <h2>10. Zgody</h2>
        <p>
          Zgody, które uczestniczka zaznacza podczas zapisu (regulamin,
          przetwarzanie danych). Większość z nich Wyjazdo generuje za Ciebie
          automatycznie — możesz dodać własne, jeśli masz na przykład
          regulamin uczestnictwa.
        </p>

        <h2>Publikacja</h2>
        <p>
          Po przejściu wszystkich kroków zobaczysz podgląd swojej strony.
          Kiedy klikniesz <em>„Opublikuj”</em>, wydarzenie staje się widoczne
          pod Twoją subdomeną i można się zapisywać.
        </p>

        <Callout variant="warning" label="Zanim opublikujesz">
          Sprawdź, czy masz dokończoną konfigurację Stripe (płatności). Bez
          niej wydarzenia płatne się nie opublikuje. Jeśli wyjazd jest
          bezpłatny, możesz publikować od razu.
        </Callout>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}

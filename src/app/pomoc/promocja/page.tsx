import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";
import { Callout } from "@/components/docs/Callout";

const SLUG = "promocja";
const TITLE = "Promocja i udostępnianie wydarzenia";
const DESCRIPTION =
  "Skąd wziąć link do wydarzenia, jak działa subdomena i co zobaczą znajomi, gdy wkleisz adres na Facebooka albo Instagrama.";
const LAST_UPDATED = "2026-05-11";

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "udostępnianie wydarzenia",
    "subdomena wyjazdo",
    "link do wydarzenia",
    "podgląd na facebooku",
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
          Każde Twoje wydarzenie ma własny adres internetowy. Wystarczy go
          skopiować i wysłać — uczestniczki wejdą na stronę, przeczytają
          szczegóły i się zapiszą.
        </p>

        <h2>Twoja subdomena</h2>
        <p>
          <strong>Subdomena</strong> to początek Twojego adresu — wybierasz
          ją przy zakładaniu konta. Na przykład, jeśli wybrałaś{" "}
          <em>kasia</em>, Twój adres to <em>kasia.wyjazdo.pl</em>. Na tej
          stronie pojawiają się wszystkie Twoje opublikowane wydarzenia.
        </p>

        <h2>Adres pojedynczego wydarzenia</h2>
        <p>
          Każde wydarzenie ma własny krótki adres, na przykład:
        </p>
        <p>
          <code>kasia.wyjazdo.pl/retreat-mazury-listopad</code>
        </p>
        <p>
          Adres dostajesz po opublikowaniu wydarzenia. W panelu obok tytułu
          jest przycisk <em>„Skopiuj link&rdquo;</em>.
        </p>

        <h2>Gdzie warto wkleić link</h2>
        <ul>
          <li>
            <strong>Facebook</strong> — w poście, w wydarzeniu na FB, w
            grupie tematycznej.
          </li>
          <li>
            <strong>Instagram</strong> — w opisie profilu („link w bio&rdquo;),
            w relacji ze stickerem linku, w historii wyróżnionej.
          </li>
          <li>
            <strong>Newsletter</strong> — w mailingu do swoich klientek.
          </li>
          <li>
            <strong>WhatsApp / Messenger</strong> — w rozmowie z konkretną
            osobą lub w grupie.
          </li>
        </ul>

        <h2>Co zobaczą znajomi, gdy wkleisz link</h2>
        <p>
          Facebook, Messenger, WhatsApp i większość innych aplikacji
          automatycznie pokazują podgląd strony — zdjęcie, tytuł i krótki
          opis. Wyjazdo dba o to, żeby ten podgląd dobrze wyglądał: pojawia
          się Twoje zdjęcie główne wydarzenia, tytuł i pierwsze zdania opisu.
        </p>

        <Callout>
          Jeśli podgląd na Facebooku wygląda dziwnie albo nie pokazuje
          zdjęcia, najczęściej to znaczy, że Facebook zapamiętał starą
          wersję strony. Można to „odświeżyć&rdquo; w narzędziu Facebook Sharing
          Debugger — w razie wątpliwości napisz do nas:{" "}
          <a href="mailto:kontakt@wyjazdo.pl">kontakt@wyjazdo.pl</a>.
        </Callout>

        <h2>Kilka praktycznych rad</h2>
        <ul>
          <li>
            <strong>Zdjęcie ma znaczenie.</strong> Mocne, jasne, z atmosferą
            miejsca — to ono sprzedaje wyjazd na pierwszy rzut oka.
          </li>
          <li>
            <strong>Pierwsze zdanie opisu.</strong> Często to wszystko, co
            ktoś przeczyta w podglądzie. Powiedz, co to za wyjazd, dla kogo
            i kiedy.
          </li>
          <li>
            <strong>Termin w tytule.</strong> Listopad? Wiosna 2026? Jeśli
            data jest w tytule, łatwiej decyduje się o kliknięciu.
          </li>
        </ul>

        <p>
          Jeśli jeszcze nie masz wydarzenia, zacznij od{" "}
          <Link href="/pomoc/tworzenie-wydarzenia">
            Tworzenie wydarzenia krok po kroku
          </Link>
          .
        </p>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}

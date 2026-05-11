import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { RelatedTopics } from "@/components/docs/RelatedTopics";

const SLUG = "faq";
const TITLE = "Najczęstsze pytania (FAQ)";
const DESCRIPTION =
  "Krótkie odpowiedzi na pytania, które dostajemy najczęściej — od bezpieczeństwa płatności po anulowanie wyjazdu i kontakt z uczestniczkami.";
const LAST_UPDATED = "2026-05-11";

type QA = { q: string; a: React.ReactNode; aText: string };

const FAQ: QA[] = [
  {
    q: "Czy Wyjazdo jest bezpieczne dla uczestniczek?",
    a: (
      <p>
        Tak. Płatności obsługuje Stripe — globalny operator certyfikowany
        zgodnie ze standardami bezpieczeństwa PCI DSS. Wyjazdo nigdy nie
        widzi numerów kart ani danych logowania do bankowości. Strony, na
        których uczestniczka podaje dane, działają w pełni szyfrowane (HTTPS).
      </p>
    ),
    aText:
      "Tak. Płatności obsługuje Stripe — globalny operator certyfikowany zgodnie ze standardami bezpieczeństwa PCI DSS. Wyjazdo nigdy nie widzi numerów kart ani danych logowania do bankowości. Strony, na których uczestniczka podaje dane, działają w pełni szyfrowane (HTTPS).",
  },
  {
    q: "Ile kosztuje Wyjazdo?",
    a: (
      <p>
        Korzystanie z Wyjazdo jest dziś bezpłatne dla organizatorek.
        Prowizję od każdej transakcji pobiera tylko operator płatności
        (Stripe) — szczegóły opisaliśmy w{" "}
        <Link href="/pomoc/cennik">Cennik</Link>.
      </p>
    ),
    aText:
      "Korzystanie z Wyjazdo jest dziś bezpłatne dla organizatorek. Prowizję od każdej transakcji pobiera tylko operator płatności (Stripe) — szczegóły opisaliśmy w sekcji Cennik.",
  },
  {
    q: "Czy muszę mieć firmę, żeby korzystać z Wyjazdo?",
    a: (
      <p>
        Tak — żeby przyjmować płatności online, potrzebujesz zarejestrowanej
        działalności gospodarczej albo spółki. Stripe wymaga numeru NIP do
        wypłat. Jeśli chcesz prowadzić wydarzenia bezpłatne, możesz korzystać
        z Wyjazdo bez konfiguracji Stripe.
      </p>
    ),
    aText:
      "Tak — żeby przyjmować płatności online, potrzebujesz zarejestrowanej działalności gospodarczej albo spółki. Stripe wymaga numeru NIP do wypłat. Jeśli chcesz prowadzić wydarzenia bezpłatne, możesz korzystać z Wyjazdo bez konfiguracji Stripe.",
  },
  {
    q: "Co się stanie, jeśli muszę odwołać cały wyjazd?",
    a: (
      <p>
        Możesz anulować wydarzenie z poziomu panelu. Wyjazdo poprowadzi Cię
        przez zwrot pieniędzy uczestniczkom — pełny, częściowy albo żaden,
        zgodnie z tym, co ustaliłaś w swoim regulaminie. Najlepiej napisz do
        uczestniczek prywatnie, zanim klikniesz anuluj.
      </p>
    ),
    aText:
      "Możesz anulować wydarzenie z poziomu panelu. Wyjazdo poprowadzi Cię przez zwrot pieniędzy uczestniczkom — pełny, częściowy albo żaden, zgodnie z tym, co ustaliłaś w swoim regulaminie. Najlepiej napisz do uczestniczek prywatnie, zanim klikniesz anuluj.",
  },
  {
    q: "Czy mogę zmienić cenę albo termin po publikacji?",
    a: (
      <p>
        Większość rzeczy tak — opis, zdjęcia, pytania, zgody. Termin i cena
        są wrażliwe: jeśli ktoś już się zapisał, zmiana wpłynie na te osoby
        i może wymagać kontaktu z nimi. Wyjazdo ostrzeże Cię przed taką
        zmianą.
      </p>
    ),
    aText:
      "Większość rzeczy tak — opis, zdjęcia, pytania, zgody. Termin i cena są wrażliwe: jeśli ktoś już się zapisał, zmiana wpłynie na te osoby i może wymagać kontaktu z nimi. Wyjazdo ostrzeże Cię przed taką zmianą.",
  },
  {
    q: "Jak długo czekam na wypłatę?",
    a: (
      <p>
        Po pomyślnej weryfikacji w Stripe wypłaty następują automatycznie,
        zwykle co kilka dni roboczych. Dokładny harmonogram zobaczysz w
        sekcji <em>Finanse</em> w panelu.
      </p>
    ),
    aText:
      "Po pomyślnej weryfikacji w Stripe wypłaty następują automatycznie, zwykle co kilka dni roboczych. Dokładny harmonogram zobaczysz w sekcji Finanse w panelu.",
  },
  {
    q: "Czy mogę mieć kilka różnych wydarzeń jednocześnie?",
    a: (
      <p>
        Tak. Nie ma limitu liczby wydarzeń. Wszystkie pojawiają się na Twojej
        subdomenie (np. <em>kasia.wyjazdo.pl</em>) — uczestniczki mogą
        wybierać między nimi.
      </p>
    ),
    aText:
      "Tak. Nie ma limitu liczby wydarzeń. Wszystkie pojawiają się na Twojej subdomenie (np. kasia.wyjazdo.pl) — uczestniczki mogą wybierać między nimi.",
  },
  {
    q: "A jeśli utknę i nie wiem, co kliknąć?",
    a: (
      <p>
        Napisz do nas:{" "}
        <a href="mailto:kontakt@wyjazdo.pl">kontakt@wyjazdo.pl</a>.
        Odpowiadamy w ciągu jednego dnia roboczego. Najczęściej w kilka
        godzin.
      </p>
    ),
    aText:
      "Napisz do nas: kontakt@wyjazdo.pl. Odpowiadamy w ciągu jednego dnia roboczego. Najczęściej w kilka godzin.",
  },
];

export const metadata: Metadata = {
  title: `${TITLE} — Wyjazdo`,
  description: DESCRIPTION,
  keywords: [
    "faq wyjazdo",
    "najczęstsze pytania wyjazdo",
    "wyjazdo pytania",
    "wyjazdo bezpieczne",
  ],
  alternates: { canonical: `/pomoc/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `/pomoc/${SLUG}` },
};

export default function Page() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "pl-PL",
    mainEntity: FAQ.map(({ q, aText }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: aText },
    })),
  };

  return (
    <>
      <DocsArticle
        slug={SLUG}
        title={TITLE}
        description={DESCRIPTION}
        lastUpdated={LAST_UPDATED}
        extraJsonLd={faqJsonLd}
      >
        <p>
          Wybrałyśmy pytania, które najczęściej dostajemy. Jeśli Twojego nie
          ma — napisz:{" "}
          <a href="mailto:kontakt@wyjazdo.pl">kontakt@wyjazdo.pl</a>.
        </p>

        <dl>
          {FAQ.map(({ q, a }) => (
            <div key={q} className="mb-6">
              <dt className="font-[family-name:var(--font-ibm-plex-serif)] text-lg font-semibold text-primary">
                {q}
              </dt>
              <dd className="mt-2 text-base leading-relaxed text-foreground">
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </DocsArticle>
      <RelatedTopics slug={SLUG} />
    </>
  );
}

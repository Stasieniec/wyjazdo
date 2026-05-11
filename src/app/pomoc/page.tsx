import type { Metadata } from "next";
import { DocsCard } from "@/components/docs/DocsCard";
import { TOPICS, getTopic } from "@/lib/docs/topics";
import { siteOrigin } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Pomoc i przewodniki — Wyjazdo",
  description:
    "Jak organizować wyjazdy, retreaty i warsztaty w Wyjazdo — zapisy, płatności online, lista uczestniczek. Prosty język, krok po kroku.",
  alternates: { canonical: "/pomoc" },
  openGraph: {
    title: "Pomoc i przewodniki — Wyjazdo",
    description:
      "Przewodniki dla organizatorek: jak zacząć, jak stworzyć wydarzenie, jak przyjmować płatności online.",
    url: "/pomoc",
    type: "website",
  },
};

export default function PomocHubPage() {
  const base = siteOrigin();
  const intro = getTopic("co-to-jest")!;
  const faq = getTopic("faq")!;
  const middle = TOPICS.filter((t) => t.slug !== "co-to-jest" && t.slug !== "faq");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Pomoc i przewodniki — Wyjazdo",
    url: `${base}/pomoc`,
    inLanguage: "pl-PL",
    description:
      "Centrum pomocy dla organizatorek wyjazdów, retreatów i warsztatów w Wyjazdo.",
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Wyjazdo", item: base },
      { "@type": "ListItem", position: 2, name: "Pomoc", item: `${base}/pomoc` },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <header className="mx-auto max-w-2xl text-center">
        <h1 className="font-[family-name:var(--font-ibm-plex-serif)] text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
          Jak korzystać z Wyjazdo
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Wszystko, czego potrzebujesz, żeby zorganizować swój pierwszy wyjazd.
          Krótkie przewodniki napisane prostym językiem — bez technicznego żargonu.
        </p>
      </header>

      <h2 className="sr-only">Tematy pomocy</h2>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <DocsCard topic={intro} wide />
        {middle.map((topic) => (
          <DocsCard key={topic.slug} topic={topic} />
        ))}
        <DocsCard topic={faq} wide />
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Nie znalazłaś odpowiedzi? Napisz:{" "}
        <a
          href="mailto:kontakt@wyjazdo.pl"
          className="font-medium text-foreground underline"
        >
          kontakt@wyjazdo.pl
        </a>
      </p>
    </div>
  );
}

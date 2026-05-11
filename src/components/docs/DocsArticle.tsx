import Link from "next/link";
import { siteOrigin } from "@/lib/urls";

type Props = {
  slug: string;
  title: string;
  description: string;
  lastUpdated: string; // ISO date string, e.g. "2026-05-11"
  extraJsonLd?: object;
  children: React.ReactNode;
};

function formatPolishDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DocsArticle({
  slug,
  title,
  description,
  lastUpdated,
  extraJsonLd,
  children,
}: Props) {
  const base = siteOrigin();
  const url = `${base}/pomoc/${slug}`;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Wyjazdo", item: base },
      { "@type": "ListItem", position: 2, name: "Pomoc", item: `${base}/pomoc` },
      { "@type": "ListItem", position: 3, name: title, item: url },
    ],
  };

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: "pl-PL",
    datePublished: lastUpdated,
    dateModified: lastUpdated,
    author: { "@type": "Organization", name: "Wyjazdo", url: base },
    publisher: {
      "@type": "Organization",
      name: "Wyjazdo",
      url: base,
      logo: { "@type": "ImageObject", url: `${base}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
      />
      {extraJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(extraJsonLd) }}
        />
      )}

      <nav aria-label="Okruszki" className="mb-6 text-sm text-muted-foreground">
        <Link href="/pomoc" className="underline hover:text-foreground">
          Pomoc
        </Link>
      </nav>

      <h1 className="font-[family-name:var(--font-ibm-plex-serif)] text-3xl font-semibold leading-tight tracking-tight text-primary sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Ostatnia aktualizacja: {formatPolishDate(lastUpdated)}
      </p>

      <div className="prose prose-neutral mt-8 max-w-none">
        {children}
      </div>
    </article>
  );
}

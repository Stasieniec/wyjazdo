export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getLatestDocument } from "@/lib/db/queries/legal";
import { markdownToHtml } from "@/lib/legal/markdown-to-html";

export const metadata: Metadata = {
  title: "Polityka Prywatności — wyjazdo.pl",
};

export default async function PolitykaPrywatnosciPage() {
  const doc = await getLatestDocument("privacy_policy");

  if (!doc) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Polityka Prywatności wyjazdo.pl</h1>
        <p className="mt-4 text-muted-foreground">Dokument jest w przygotowaniu.</p>
      </div>
    );
  }

  return (
    <article className="prose prose-neutral max-w-none">
      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(doc.content) }} />
      <p className="mt-8 text-sm text-muted-foreground">
        Wersja {doc.version} — obowiązuje od{" "}
        {new Date(doc.effectiveAt).toLocaleDateString("pl-PL")}
      </p>
    </article>
  );
}

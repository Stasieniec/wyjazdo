import type { Metadata } from "next";
import { getLatestDocument } from "@/lib/db/queries/legal";

export const metadata: Metadata = {
  title: "Regulamin — wyjazdo.pl",
};

export default async function RegulaminPage() {
  const doc = await getLatestDocument("regulamin");

  if (!doc) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Regulamin serwisu wyjazdo.pl</h1>
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

/** Minimal markdown-to-HTML for legal docs (headings, paragraphs, lists, bold, links). */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hulo])/gm, (line) => (line.trim() ? `<p>${line}` : ""))
    .replace(/<p><(h[1-3]|ul|li|ol)/g, "<$1");
}

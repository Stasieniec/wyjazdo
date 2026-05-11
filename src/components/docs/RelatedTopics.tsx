import { getRelatedTopics } from "@/lib/docs/topics";
import { DocsCard } from "./DocsCard";

export function RelatedTopics({ slug }: { slug: string }) {
  const related = getRelatedTopics(slug);
  if (related.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-6 pb-16">
      <h2 className="font-[family-name:var(--font-ibm-plex-serif)] text-xl font-semibold text-primary">
        Co dalej?
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((topic) => (
          <DocsCard key={topic.slug} topic={topic} />
        ))}
      </div>
    </section>
  );
}

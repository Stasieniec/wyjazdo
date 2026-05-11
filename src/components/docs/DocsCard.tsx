import Link from "next/link";
import { Icon } from "./Icon";
import type { Topic } from "@/lib/docs/topics";

type Props = {
  topic: Topic;
  /** When true, render a wider card (e.g. col-span-2 on hub). */
  wide?: boolean;
};

export function DocsCard({ topic, wide }: Props) {
  return (
    <Link
      href={`/pomoc/${topic.slug}`}
      className={`group relative flex flex-col rounded-2xl border border-primary/5 bg-white p-6 shadow-[0_15px_40px_-30px_rgba(30,58,95,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-25px_rgba(30,58,95,0.5)] ${
        wide ? "sm:col-span-2 lg:col-span-3" : ""
      }`}
    >
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/12 text-accent">
        <Icon id={topic.icon} />
      </span>
      <h3 className="font-[family-name:var(--font-ibm-plex-serif)] text-lg font-semibold text-primary">
        {topic.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {topic.blurb}
      </p>
    </Link>
  );
}

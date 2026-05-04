"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { slugify } from "@/lib/utils/slug";

type Props = {
  subdomain: string;
  rootDomain: string;
  defaultTitle?: string;
  defaultSlug?: string;
  errors?: { title?: string; slug?: string };
  pending?: boolean;
  onBack: () => void;
  onNext: (title: string, slug: string) => void;
};

export function StepTitle({
  subdomain,
  rootDomain,
  defaultTitle = "",
  defaultSlug = "",
  errors,
  pending,
  onBack,
  onNext,
}: Props) {
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState(defaultSlug);
  const [slugEditedManually, setSlugEditedManually] = useState(defaultSlug.length > 0);
  const [showSlugEditor, setShowSlugEditor] = useState(defaultSlug.length > 0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function handleTitleChange(next: string) {
    setTitle(next);
    if (!slugEditedManually) setSlug(slugify(next));
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onNext(title.trim(), slug.trim().toLowerCase());
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        Jak nazywa się wydarzenie?
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Tak będzie widoczne dla uczestniczek na stronie zapisów.
      </p>

      <div className="mt-7 space-y-4">
        <Input
          name="title"
          label="Tytuł"
          required
          maxLength={200}
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          error={errors?.title}
        />

        <div className="rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
          {subdomain}.{rootDomain}/<strong className="text-foreground">{slug || "..."}</strong>
        </div>

        {!showSlugEditor && (
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => setShowSlugEditor(true)}
          >
            Edytuj URL
          </button>
        )}
        {showSlugEditor && (
          <Input
            name="slug"
            label="Adres w URL"
            required
            pattern="[a-z0-9](?:[a-z0-9]|-)*[a-z0-9]"
            minLength={3}
            maxLength={64}
            value={slug}
            onChange={(e) => {
              setSlugEditedManually(true);
              setSlug(e.target.value.toLowerCase());
            }}
            error={errors?.slug}
          />
        )}
      </div>

      <WizardFooter onBack={onBack} pending={pending} />
    </form>
  );
}

function WizardFooter({
  onBack,
  pending,
  showSkip,
  onSkip,
}: {
  onBack: () => void;
  pending?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
}) {
  return (
    <div className="mt-auto flex flex-col gap-2 pt-10 md:flex-row-reverse md:items-center md:gap-3">
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] disabled:opacity-60 md:flex-1"
      >
        {pending ? "Zapisuję…" : "Dalej →"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full px-4 py-3 text-sm font-medium text-[#6B7280] hover:text-[#1E3A5F] md:w-auto"
      >
        ← Wstecz
      </button>
      {showSkip && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full px-4 py-3 text-sm text-[#6B7280] underline hover:text-[#1E3A5F] md:w-auto"
        >
          Pomiń teraz, ustawię później
        </button>
      )}
    </div>
  );
}

export { WizardFooter };

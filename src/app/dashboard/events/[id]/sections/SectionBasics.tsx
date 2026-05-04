"use client";

import { useActionState, useState } from "react";
import { Input, Textarea } from "@/components/ui";
import { saveSectionBasicsAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = {
  eventId: string;
  subdomain: string;
  rootDomain: string;
  initial: { title: string; slug: string; description: string };
};

export function SectionBasics({ eventId, subdomain, rootDomain, initial }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    saveSectionBasicsAction.bind(null, eventId),
    null,
  );
  const [slug, setSlug] = useState(initial.slug);
  const errors = state && "errors" in state ? state.errors : {};

  return (
    <SectionShell id="podstawy" title="Podstawy" action={action} state={state}>
      <Input
        name="title"
        label="Tytuł"
        defaultValue={initial.title}
        required
        maxLength={200}
        error={errors.title}
      />
      <div>
        <Input
          name="slug"
          label="Adres w URL"
          required
          pattern="[a-z0-9](?:[a-z0-9]|-)*[a-z0-9]"
          minLength={3}
          maxLength={64}
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          error={errors.slug}
        />
        <p className="mt-1.5 rounded-lg bg-muted/60 px-3 py-1.5 font-mono text-xs text-muted-foreground">
          {subdomain}.{rootDomain}/<strong className="text-foreground">{slug || "..."}</strong>
        </p>
      </div>
      <Textarea
        name="description"
        label="Opis"
        defaultValue={initial.description}
        rows={6}
        error={errors.description}
      />
    </SectionShell>
  );
}

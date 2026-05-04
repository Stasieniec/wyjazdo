"use client";

import { type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui";

type Props = {
  id: string; // anchor id (e.g. "podstawy")
  title: string;
  description?: string;
  /** Form action returned by `useActionState` (already bound to the server action). */
  action: (formData: FormData) => void | Promise<void>;
  /** Result from `useActionState` — passed in by the parent for inline error/success display. */
  state: { ok: true } | { errors: Record<string, string> } | null;
  children: ReactNode;
};

export function SectionShell({ id, title, description, action, state, children }: Props) {
  return (
    <section id={id} className="scroll-mt-20">
      <Card>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <form action={action} className="mt-5 space-y-4">
          {children}
          <div className="flex items-center gap-3">
            <SubmitButton />
            {state && "ok" in state && <p className="text-sm text-success">Zapisano.</p>}
          </div>
        </form>
      </Card>
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
    >
      {pending ? "Zapisuję…" : "Zapisz zmiany"}
    </button>
  );
}

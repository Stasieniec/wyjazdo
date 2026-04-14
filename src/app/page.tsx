import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export default function MarketingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Show when="signed-out">
        <nav className="mb-12 flex flex-wrap items-center justify-end gap-3 text-sm">
          <Link
            href="/sign-in"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Zaloguj się
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Załóż konto
          </Link>
        </nav>
      </Show>
      <Show when="signed-in">
        <nav className="mb-12 flex flex-wrap items-center justify-end gap-4 text-sm">
          <Link
            href="/dashboard"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Panel organizatora
          </Link>
          <UserButton />
        </nav>
      </Show>
      <h1 className="text-4xl font-bold tracking-tight text-foreground">wyjazdo.pl</h1>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-muted-foreground">
        Platforma dla organizatorów wyjazdów, warsztatów i retreatów.
      </p>
    </main>
  );
}

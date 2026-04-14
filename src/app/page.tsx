import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export default function MarketingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Show when="signed-out">
        <nav className="mb-12 flex flex-wrap items-center justify-end gap-3 text-sm">
          <Link
            href="/sign-in"
            className="text-neutral-700 underline-offset-4 hover:underline"
          >
            Zaloguj się
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-800"
          >
            Załóż konto
          </Link>
        </nav>
      </Show>
      <Show when="signed-in">
        <nav className="mb-12 flex flex-wrap items-center justify-end gap-4 text-sm">
          <Link
            href="/dashboard"
            className="text-neutral-700 underline-offset-4 hover:underline"
          >
            Panel organizatora
          </Link>
          <UserButton />
        </nav>
      </Show>
      <h1 className="text-4xl font-bold tracking-tight">wyjazdo.pl</h1>
      <p className="mt-4 text-lg text-neutral-600">
        Platforma dla organizatorów wyjazdów, warsztatów i retreatów.
      </p>
    </main>
  );
}

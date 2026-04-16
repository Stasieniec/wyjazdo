"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-destructive">Błąd</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">
        Coś poszło nie tak
      </h1>
      <p className="mt-4 max-w-sm text-muted-foreground" role="alert">
        Wystąpił nieoczekiwany błąd. Spróbuj ponownie, lub wróć później.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Spróbuj ponownie
      </button>
    </main>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">
        Strona nie istnieje
      </h1>
      <p className="mt-4 max-w-sm text-muted-foreground" role="alert">
        Nie znaleźliśmy strony, której szukasz. Sprawdź adres lub wróć na stronę główną.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Strona główna
      </Link>
    </main>
  );
}

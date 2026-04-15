import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link
        href="/"
        className="mb-6 text-xl font-bold tracking-tight text-primary"
      >
        wyjazdo
      </Link>
      <SignIn />
      <p className="mt-6 text-xs text-muted-foreground">
        Nie masz konta?{" "}
        <Link href="/sign-up" className="font-medium text-foreground hover:underline">
          Załóż konto
        </Link>
      </p>
    </main>
  );
}

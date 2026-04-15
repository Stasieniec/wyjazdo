import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link
        href="/"
        className="mb-6 text-xl font-bold tracking-tight text-primary"
      >
        wyjazdo
      </Link>
      <SignUp />
      <p className="mt-6 text-xs text-muted-foreground">
        Masz już konto?{" "}
        <Link href="/sign-in" className="font-medium text-foreground hover:underline">
          Zaloguj się
        </Link>
      </p>
    </main>
  );
}

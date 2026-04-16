export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  signMagicLinkOneTime,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";
import { sendMagicLinkEmail } from "@/lib/email/send";
import { WyjazdoMark } from "@/components/brand/WyjazdoMark";

function origin() {
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  return `${proto}//${host}`;
}

export default async function RequestLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; invalid?: string }>;
}) {
  const sp = await searchParams;

  async function submit(form: FormData) {
    "use server";
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!email) redirect("/my-trips/request-link");
    const secret = getParticipantAuthSecret();
    const now = Date.now();
    const token = await signMagicLinkOneTime(email, now, secret);
    const link = `${origin()}/my-trips/signin?token=${encodeURIComponent(token)}`;
    await sendMagicLinkEmail({ to: email, link });
    redirect("/my-trips/request-link?sent=1");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-primary">
            <WyjazdoMark className="h-7 w-7 shrink-0" />
            wyjazdo
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 space-y-4">
        <h1 className="text-xl font-bold sm:text-2xl">Twoje wyjazdy</h1>
        {sp.invalid && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Link wygasł lub jest nieprawidłowy. Poproś o nowy poniżej.
          </div>
        )}
        {sp.sent ? (
          <div className="rounded-xl border border-success/40 bg-success/5 p-4 text-sm text-success">
            Wysłaliśmy link logowania. Sprawdź skrzynkę.
          </div>
        ) : (
          <form action={submit} className="space-y-3">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email, z którym się rejestrowałeś/aś
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="twoj@email.pl"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[--shadow-warm] transition-all duration-150 hover:bg-accent/90"
            >
              Wyślij link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

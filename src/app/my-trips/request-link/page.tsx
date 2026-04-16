import { redirect } from "next/navigation";
import {
  signMagicLinkOneTime,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";
import { sendMagicLinkEmail } from "@/lib/email/send";

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
    <div className="max-w-md mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Twoje wyjazdy</h1>
      {sp.invalid && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Link wygasł lub jest nieprawidłowy. Poproś o nowy poniżej.
        </p>
      )}
      {sp.sent ? (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Wysłaliśmy link logowania. Sprawdź skrzynkę.
        </p>
      ) : (
        <form action={submit} className="space-y-3">
          <label htmlFor="email" className="block text-sm font-medium">
            Email, z którym się rejestrowałeś/aś
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="twoj@email.pl"
            className="w-full rounded border px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-neutral-800"
          >
            Wyślij link
          </button>
        </form>
      )}
    </div>
  );
}

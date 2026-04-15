import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  verifyMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";

export default async function MyTripsIndex() {
  const secret = getParticipantAuthSecret();
  const now = Date.now();
  const c = (await cookies()).get("wyjazdo_participant_email")?.value;
  if (!c) redirect("/my-trips/request-link");
  const session = await verifyMagicLinkCookie(c, secret, now);
  if (!session) redirect("/my-trips/request-link?invalid=1");

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-4">Twoje wyjazdy</h1>
      <p className="text-sm text-neutral-600">Zalogowano jako {session.email}.</p>
      <p className="text-sm text-neutral-500 mt-8">(Lista wyjazdów zostanie dodana w następnym kroku.)</p>
    </div>
  );
}

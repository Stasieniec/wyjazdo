import Link from "next/link";
import { getOrganizerBySubdomain } from "@/lib/db/queries/organizers";

function marketingSiteUrl(): string {
  const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "wyjazdo.pl";
  return host.includes("localhost") ? `http://${host}` : `https://${host}`;
}

export default async function OrganizerSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const organizer = await getOrganizerBySubdomain(subdomain);

  if (!organizer) {
    const home = marketingSiteUrl();
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-16 text-center">
        <p className="text-lg leading-relaxed text-foreground">
          Ta strona jeszcze nie istnieje. Wejdź na{" "}
          <Link
            href={home}
            className="font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary/90"
          >
            wyjazdo.pl
          </Link>{" "}
          aby ją stworzyć, lub skontaktuj się z nami jeśli to jest błąd.
        </p>
      </main>
    );
  }

  return <>{children}</>;
}

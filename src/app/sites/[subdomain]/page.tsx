import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizerBySubdomain, getPublishedEventsByOrganizer } from "@/lib/db/queries/organizers";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) return {};

  return {
    title: `${organizer.displayName} — wyjazdo.pl`,
    description: organizer.description?.slice(0, 160) ?? `${organizer.displayName} na wyjazdo.pl`,
    openGraph: {
      title: organizer.displayName,
      description: organizer.description?.slice(0, 160) ?? "",
      ...(organizer.coverUrl ? { images: [{ url: organizer.coverUrl }] } : {}),
    },
  };
}

export default async function OrganizerProfilePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const organizer = await getOrganizerBySubdomain(subdomain);
  if (!organizer) notFound();

  const events = await getPublishedEventsByOrganizer(organizer.id);
  const social = organizer.socialLinks
    ? (JSON.parse(organizer.socialLinks) as Record<string, string | null>)
    : {};
  const brandColor = organizer.brandColor ?? "#1E3A5F";

  return (
    <main
      className="min-h-screen bg-background"
      style={{ "--brand": brandColor } as React.CSSProperties}
    >
      {/* Cover */}
      {organizer.coverUrl ? (
        <div className="relative h-48 w-full sm:h-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={organizer.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className="h-32 w-full sm:h-48"
          style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
        />
      )}

      <div className="mx-auto max-w-3xl px-6">
        {/* Profile header */}
        <div className="-mt-10 flex items-end gap-4">
          {organizer.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organizer.logoUrl}
              alt=""
              className="h-20 w-20 rounded-xl border-4 border-background object-cover shadow-sm"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-xl border-4 border-background text-2xl font-bold text-white shadow-sm"
              style={{ backgroundColor: brandColor }}
            >
              {organizer.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="pb-1 text-2xl font-bold text-foreground sm:text-3xl">
            {organizer.displayName}
          </h1>
        </div>

        {/* Description */}
        {organizer.description && (
          <p className="mt-6 max-w-prose whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {organizer.description}
          </p>
        )}

        {/* Contact & social links */}
        <SocialLinks
          email={organizer.contactEmail}
          phone={organizer.contactPhone}
          social={social}
          brandColor={brandColor}
        />

        {/* Events */}
        <section className="mt-12 pb-16">
          <h2 className="text-xl font-semibold text-foreground">
            Nadchodzące wydarzenia
          </h2>
          {events.length === 0 ? (
            <p className="mt-4 text-muted-foreground">
              Brak nadchodzących wydarzeń.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {events.map((e) => {
                const price = new Intl.NumberFormat("pl-PL", {
                  style: "currency",
                  currency: "PLN",
                }).format(e.priceCents / 100);
                const dateStr = new Date(e.startsAt).toLocaleDateString("pl-PL", {
                  day: "numeric",
                  month: "long",
                });
                return (
                  <Link
                    key={e.id}
                    href={`/${e.slug}`}
                    className="group rounded-xl border border-border bg-background p-5 transition-colors hover:border-muted-foreground/30"
                  >
                    {e.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.coverUrl}
                        alt=""
                        className="mb-4 h-36 w-full rounded-lg object-cover"
                      />
                    )}
                    <h3 className="font-semibold text-foreground group-hover:underline">
                      {e.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>{dateStr}</span>
                      {e.location && (
                        <>
                          <span className="text-border">·</span>
                          <span>{e.location}</span>
                        </>
                      )}
                      <span className="text-border">·</span>
                      <span className="font-medium text-foreground">{price}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Powered by{" "}
        <a
          href="https://wyjazdo.pl"
          className="font-medium text-foreground hover:underline"
        >
          wyjazdo.pl
        </a>
      </footer>
    </main>
  );
}

function SocialLinks({
  email,
  phone,
  social,
  brandColor,
}: {
  email: string | null;
  phone: string | null;
  social: Record<string, string | null>;
  brandColor: string;
}) {
  const links: { label: string; href: string }[] = [];
  if (social.website) links.push({ label: "Strona WWW", href: social.website });
  if (social.instagram)
    links.push({
      label: "Instagram",
      href: social.instagram.startsWith("http")
        ? social.instagram
        : `https://instagram.com/${social.instagram.replace(/^@/, "")}`,
    });
  if (social.facebook)
    links.push({
      label: "Facebook",
      href: social.facebook.startsWith("http")
        ? social.facebook
        : `https://facebook.com/${social.facebook}`,
    });

  if (!email && !phone && links.length === 0) return null;

  return (
    <div className="mt-6 flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-2 text-sm sm:gap-x-3">
      {email && (
        <a
          href={`mailto:${email}`}
          className="max-w-full min-w-0 break-words rounded-full border border-border px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          {email}
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="max-w-full min-w-0 break-words rounded-full border border-border px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          {phone}
        </a>
      )}
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full border border-border px-3 py-1 transition-colors hover:text-foreground"
          style={{ color: brandColor }}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

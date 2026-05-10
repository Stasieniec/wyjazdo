import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { publicEventUrl, siteOrigin } from "@/lib/urls";
import { getDb, schema } from "@/lib/db/client";

// getDb() reaches into the Cloudflare context, which is not available during
// static prerendering. Render the sitemap at request time instead.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();
  const db = getDb();
  const publishedEvents = await db
    .select({
      slug: schema.events.slug,
      updatedAt: schema.events.updatedAt,
      subdomain: schema.organizers.subdomain,
    })
    .from(schema.events)
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(eq(schema.events.status, "published"));

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/regulamin`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${base}/polityka-prywatnosci`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const eventPages: MetadataRoute.Sitemap = publishedEvents.map((event) => ({
    url: publicEventUrl(event.subdomain, event.slug),
    lastModified: new Date(event.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    ...staticPages,
    ...eventPages,
  ];
}

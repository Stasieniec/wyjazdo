import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteOrigin();
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}

import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/urls";

export default function manifest(): MetadataRoute.Manifest {
  const base = siteOrigin();
  return {
    name: "Wyjazdo",
    short_name: "Wyjazdo",
    description:
      "Platforma dla organizatorów wyjazdów i wydarzeń — zapisy, płatności online i panel uczestników.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: "#1E3A5F",
    lang: "pl",
    icons: [
      {
        src: `${base}/logo.png`,
        type: "image/png",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}

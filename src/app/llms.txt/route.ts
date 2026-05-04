import { siteOrigin } from "@/lib/urls";

export function GET() {
  const base = siteOrigin();
  const body = [
    "# Wyjazdo",
    "",
    "> Platforma do organizacji wyjazdów, zapisów i płatności online w Polsce.",
    "",
    "## Canonical site",
    `- ${base}`,
    "",
    "## Public pages",
    `- ${base}/ (strona główna)`,
    `- ${base}/regulamin`,
    `- ${base}/polityka-prywatnosci`,
    "",
    "## Summary for LLMs",
    "- Product language: Polish (pl-PL)",
    "- Audience: organizatorzy wyjazdów, retreatów i warsztatów",
    "- Core features: zapisy uczestników, płatności (BLIK/Przelewy24/karta), panel organizatora",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

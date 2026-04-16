import { siteOrigin } from "@/lib/urls";

/**
 * Mark for @vercel/og / ImageResponse — same file as `public/logo.png`.
 * Uses the public URL (not a hashed `/_next/static/...` path) so OG can load the PNG reliably.
 */
export function WyjazdoMarkOg({ size }: { size: number }) {
  const src = `${siteOrigin()}/logo.png`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- @vercel/og ImageResponse requires <img>
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      style={{ display: "flex", objectFit: "contain" }}
    />
  );
}

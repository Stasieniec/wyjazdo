/**
 * Inline mark for @vercel/og / ImageResponse (no external SVG fetch).
 * Keep in sync with public/logo.svg visually.
 */
export function WyjazdoMarkOg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#1E3A5F" />
      <path
        d="M7 24 Q 16 26 26 11"
        stroke="#E8683A"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="26" cy="11" r="2.8" fill="#E8683A" />
    </svg>
  );
}

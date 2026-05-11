import type { IconId } from "@/lib/docs/topics";

const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PATHS: Record<IconId, React.ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v5h1" />
    </>
  ),
  rocket: (
    <>
      <path d="M5 14l5 5c1-3 5-7 8-8 1-3 1-7-1-9-2-2-6-2-9-1-1 3-5 7-8 8l5 5" />
      <circle cx="14" cy="10" r="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v6" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M16 13h2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.866 3.134-7 7-7s7 3.134 7 7" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M22 18c0-2.761-2.239-5-5-5" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.5 10.5L15.5 6.5M8.5 13.5L15.5 17.5" />
    </>
  ),
  tag: (
    <>
      <path d="M20 12l-8 8-8-8V4h8z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4M12 17h.01" />
    </>
  ),
};

export function Icon({ id, className }: { id: IconId; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className={className}
      aria-hidden
      {...STROKE_PROPS}
    >
      {PATHS[id]}
    </svg>
  );
}

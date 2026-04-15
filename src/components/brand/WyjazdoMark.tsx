export function WyjazdoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="var(--wyjazdo-mark-bg, #1E3A5F)" />
      <path
        d="M7 24 Q 16 26 26 11"
        stroke="var(--wyjazdo-mark-accent, #E8683A)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="26" cy="11" r="2.8" fill="var(--wyjazdo-mark-accent, #E8683A)" />
    </svg>
  );
}

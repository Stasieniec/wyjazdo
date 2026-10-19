import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Show } from "@clerk/nextjs";

export const CABIN_PHOTO = {
  src: "/cabin-forest.jpg",
  width: 640,
  height: 427,
  alt: "Drewniany dom w lesie",
};

export function CabinPhoto({ className, priority }: { className: string; priority?: boolean }) {
  return (
    <Image
      src={CABIN_PHOTO.src}
      width={CABIN_PHOTO.width}
      height={CABIN_PHOTO.height}
      alt={CABIN_PHOTO.alt}
      priority={priority}
      // Already resized to 640px wide; the Worker has no image optimizer binding.
      unoptimized
      className={`block w-full object-cover ${className}`}
    />
  );
}

export function Container({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`mx-auto max-w-[1200px] px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function SectionHeading({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className={`m-0 font-heading text-[clamp(30px,3.6vw,44px)] font-normal leading-[1.1] tracking-[-0.01em] text-balance ${className}`}
    >
      {children}
    </h2>
  );
}

const pill =
  "inline-flex items-center justify-center rounded-full font-semibold no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

export const buttonStyles = {
  primary: `${pill} bg-terracotta text-white hover:bg-terracotta-dark hover:text-white focus-visible:outline-terracotta`,
  secondary: `${pill} bg-cream text-ink shadow-[inset_0_0_0_1px_var(--color-hairline)] hover:bg-white hover:text-ink focus-visible:outline-terracotta`,
};

/**
 * "Załóż stronę" for visitors, "Przejdź do panelu" for signed-in organizers.
 */
export function StartLink({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <>
      <Show when="signed-out">
        <Link href="/sign-up" className={className}>
          {label}
        </Link>
      </Show>
      <Show when="signed-in">
        <Link href="/dashboard" className={className}>
          Przejdź do panelu
        </Link>
      </Show>
    </>
  );
}

export function CheckBadge() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" className="shrink-0">
      <circle cx="22" cy="22" r="21" fill="#5E6B3F" />
      <path
        d="M13 22 L19 28 L31 16"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

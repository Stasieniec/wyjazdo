import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { buttonStyles } from "./shared";

export function LandscapeMark({ className = "" }: { className?: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" className={className}>
      <path d="M3 24 L11 12 L16 18 L20 13 L27 24 Z" fill="#5E6B3F" />
      <circle cx="21" cy="8" r="3.5" fill="#D9A441" />
    </svg>
  );
}

const navLink = "text-ink no-underline hover:text-terracotta";

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-[22px] sm:px-6">
      <Link href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
        <LandscapeMark />
        <span className="font-heading text-[26px] leading-none">wyjazdo</span>
      </Link>
      <nav aria-label="Główna" className="flex flex-wrap items-center gap-x-[26px] gap-y-2 font-medium">
        <a href="#jak" className={`${navLink} max-sm:hidden`}>
          Jak to działa
        </a>
        <a href="#koszt" className={`${navLink} max-sm:hidden`}>
          Ile kosztuje
        </a>
        <a href="#pytania" className={`${navLink} max-sm:hidden`}>
          Pytania
        </a>
        <Show when="signed-out">
          <Link href="/sign-in" className={navLink}>
            Zaloguj się
          </Link>
          <Link href="/sign-up" className={`${buttonStyles.primary} px-5 py-[11px]`}>
            Załóż stronę
          </Link>
        </Show>
        <Show when="signed-in">
          <Link href="/dashboard" className={`${buttonStyles.primary} px-5 py-[11px]`}>
            Panel organizatora
          </Link>
        </Show>
      </nav>
    </header>
  );
}

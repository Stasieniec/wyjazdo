import Link from "next/link";
import { StartLink } from "./shared";

const footerLink = "text-oat underline underline-offset-[3px] hover:text-white";

export function SiteFooter() {
  return (
    <footer className="bg-ink text-oat">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-10 gap-y-5 px-4 py-14 sm:px-6">
        <p className="m-0 max-w-[640px] font-heading text-[clamp(26px,3vw,36px)] leading-[1.2]">
          Najbliższy wyjazd możesz mieć w wyjazdo jeszcze dziś wieczorem.
        </p>
        <StartLink
          label="Załóż stronę wyjazdu"
          className="inline-flex items-center justify-center rounded-full bg-ochre px-7 py-[15px] font-bold text-ink no-underline hover:bg-[#E4B75E] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ochre"
        />
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-x-6 gap-y-3 border-t border-ink-body px-4 pt-5 pb-7 text-sm sm:px-6">
        <span>wyjazdo.pl · Narrative Impact Jacek Wasilewski</span>
        <nav aria-label="Informacje" className="flex flex-wrap gap-5">
          <Link href="/regulamin" className={footerLink}>
            Regulamin
          </Link>
          <Link href="/polityka-prywatnosci" className={footerLink}>
            Prywatność
          </Link>
          <Link href="/pomoc" className={footerLink}>
            Pomoc
          </Link>
        </nav>
      </div>
    </footer>
  );
}

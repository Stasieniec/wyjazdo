import { CallbackDialog } from "./CallbackDialog";
import { Container, SectionHeading } from "./shared";

export function ContactSection() {
  return (
    <section id="kontakt" aria-labelledby="kontakt-sekcja-tytul" className="scroll-mt-4 bg-moss text-cream">
      <Container className="flex flex-wrap items-start gap-x-[72px] gap-y-10 py-[88px]">
        <div className="flex flex-[1_1_340px] flex-col gap-4">
          <SectionHeading id="kontakt-sekcja-tytul">Masz wyjazd i nie wiesz, od czego zacząć?</SectionHeading>
          <p className="m-0 text-[#E9E6D8]">
            Zostaw numer telefonu albo e-mail. Zadzwonimy, posłuchamy, jak organizujesz swoje wyjazdy, i założymy z
            Tobą pierwszą stronę.
          </p>
        </div>
        <div className="flex flex-[1_1_340px] flex-col items-start gap-3.5 pt-2">
          <CallbackDialog />
          <span className="text-base text-[#E9E6D8]">
            Wolisz napisać sama?{" "}
            <a
              href="mailto:kontakt@wyjazdo.pl"
              className="font-semibold text-cream underline underline-offset-[3px] hover:text-white"
            >
              kontakt@wyjazdo.pl
            </a>
          </span>
        </div>
      </Container>
    </section>
  );
}

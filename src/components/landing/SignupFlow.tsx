import type { ReactNode } from "react";
import { CabinPhoto, CheckBadge, Container, SectionHeading } from "./shared";

function Phone({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex flex-col items-center gap-3.5">
      <div className="w-[260px] rounded-[34px] bg-ink p-[9px]">
        <div className="flex h-[500px] flex-col overflow-hidden rounded-[26px] bg-white">{children}</div>
      </div>
      <figcaption className="text-[15px] text-ink-body">{caption}</figcaption>
    </figure>
  );
}

/** Looks like a filled-in input; the screens are pictures, so nothing here is focusable. */
function FakeField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[3px] text-ink-muted">
      {label}
      <span className="rounded-lg border border-hairline bg-cream px-[9px] py-[7px] text-sm text-ink">{value}</span>
    </div>
  );
}

function FakeChoice({ type, checked, children }: { type: "radio" | "checkbox"; checked: boolean; children: ReactNode }) {
  const shape = type === "radio" ? "rounded-full" : "rounded-[3px]";
  return (
    <div className="-mt-1.5 flex items-start gap-2 text-ink">
      <span
        aria-hidden="true"
        className={`mt-[3px] flex h-[13px] w-[13px] shrink-0 items-center justify-center border ${shape} ${
          checked ? "border-terracotta bg-terracotta" : "border-ink-muted bg-white"
        }`}
      >
        {checked ? <span className={`h-[5px] w-[5px] bg-white ${shape}`} /> : null}
      </span>
      <span>
        {children}
        <span className="sr-only">{checked ? " (zaznaczone)" : " (niezaznaczone)"}</span>
      </span>
    </div>
  );
}

const fakeButton = "rounded-full p-[11px] text-center text-sm font-semibold";

function EventScreen() {
  return (
    <>
      <CabinPhoto className="h-[150px]" />
      <div className="flex flex-1 flex-col gap-[7px] p-4">
        <span className="text-xs font-semibold text-moss">Chatka Zagajdzie</span>
        <span className="font-heading text-xl leading-[1.15]">OdNowa. Kobiecy weekend</span>
        <span className="text-[13px] text-ink-muted">
          piątek 15 stycznia, od 16:00
          <br />
          niedziela 17 stycznia, około 15:00
        </span>
        <span className="text-[13px] text-ink-muted">Zostało 4 z 16 miejsc</span>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-[#EEE5D6] pt-2.5">
          <span className="text-xl font-bold">1580 zł</span>
          <span className="text-[13px] text-ink-muted">600 zł teraz, 980 zł do 1 stycznia</span>
        </div>
        <span className={`${fakeButton} bg-terracotta text-white`}>Zapisz się</span>
      </div>
    </>
  );
}

function FormScreen() {
  return (
    <div className="flex flex-1 flex-col gap-2.5 px-4 py-[18px] text-[13px]">
      <span className="font-heading text-lg leading-[1.2]">
        <span className="block font-body text-xs text-ink-muted">Zapis</span>
        OdNowa. Kobiecy weekend
      </span>
      <FakeField label="Imię i nazwisko" value="Anna Kowalska" />
      <FakeField label="E-mail" value="anna@poczta.pl" />
      <span className="text-ink-muted">Pokój</span>
      <FakeChoice type="radio" checked>
        dwuosobowy
      </FakeChoice>
      <FakeChoice type="radio" checked={false}>
        jednoosobowy, +300 zł
      </FakeChoice>
      <FakeField label="Dieta" value="wegetariańska" />
      <div className="text-xs leading-[1.4]">
        <FakeChoice type="checkbox" checked>
          Akceptuję regulamin organizatora
        </FakeChoice>
      </div>
      <span className={`${fakeButton} mt-auto bg-terracotta text-white`}>Zapłać zaliczkę 600 zł</span>
    </div>
  );
}

function PaidScreen() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 py-[22px] text-sm">
      <CheckBadge />
      <span className="font-heading text-xl leading-[1.2]">Jesteś zapisana</span>
      <span className="text-ink-body">Zaliczka 600 zł wpłynęła. Potwierdzenie wysłaliśmy na anna@poczta.pl.</span>
      <div className="flex flex-col gap-1 rounded-xl bg-oat p-3">
        <span className="font-semibold">Dopłata 980 zł</span>
        <span className="text-[13px] text-ink-body">do 1 stycznia. Przypomnimy Ci mailem dwa tygodnie wcześniej.</span>
      </div>
      <span className="text-[13px] text-ink-body">Organizator: Chatka Zagajdzie, kontakt@chatkazagajdzie.pl</span>
      <span className={`${fakeButton} mt-auto bg-cream text-ink shadow-[inset_0_0_0_1px_var(--color-hairline)]`}>
        Moja rezerwacja
      </span>
    </div>
  );
}

export function SignupFlow() {
  return (
    <section id="zapis" aria-labelledby="zapis-tytul" className="scroll-mt-4 bg-sand">
      <Container className="flex flex-col gap-10 py-20">
        <div className="flex flex-wrap items-end gap-x-[72px] gap-y-4">
          <SectionHeading id="zapis-tytul" className="flex-[1_1_400px]">
            Zapis zajmuje uczestniczce dwie minuty
          </SectionHeading>
          <p className="m-0 flex-[1_1_400px] text-ink-body">
            Bez zakładania konta. Wszystko na telefonie, BLIK-iem albo szybkim przelewem. Do swojej rezerwacji wraca
            przez link z maila.
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-center gap-7">
          <Phone caption="Strona wyjazdu">
            <EventScreen />
          </Phone>
          <Phone caption="Formularz zapisu">
            <FormScreen />
          </Phone>
          <Phone caption="Po wpłacie">
            <PaidScreen />
          </Phone>
        </div>
      </Container>
    </section>
  );
}

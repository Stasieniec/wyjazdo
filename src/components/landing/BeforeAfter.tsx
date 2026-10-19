import { Container, SectionHeading } from "./shared";

const ROWS = [
  {
    before: "Odpisujesz na maile, czy zostały jeszcze miejsca.",
    after: "Liczba wolnych miejsc jest na stronie i zmniejsza się z każdym zapisem.",
  },
  {
    before: "Szukasz na koncie przelewu z tytułem „zaliczka Ania”.",
    after: "Wpłata pojawia się przy jej nazwisku, zanim zdążysz sprawdzić konto.",
  },
  {
    before: "Przypominasz o dopłacie SMS-ami, osoba po osobie.",
    after: "Przypomnienie wychodzi samo: dwa tygodnie przed terminem, trzy dni przed i w dniu terminu.",
  },
  {
    before: "Zbierasz z maili, kto je mięso, a kto nie ma glutenu.",
    after: "Dieta i pokój są w tej samej tabeli co wpłaty. Drukujesz ją dla kuchni.",
  },
];

const row = "grid min-[856px]:grid-cols-2 gap-x-12 gap-y-2 border-t border-hairline";

export function BeforeAfter() {
  return (
    <section aria-labelledby="recznie-tytul">
      <Container className="flex flex-col gap-9 pt-[88px] pb-20">
        <SectionHeading id="recznie-tytul" className="max-w-[760px]">
          Co przestajesz robić ręcznie
        </SectionHeading>
        <div className="flex flex-col">
          {/* Column labels; on one-column phones each cell carries its own label instead. */}
          <div aria-hidden="true" className={`${row} py-[18px] text-sm font-semibold text-ink-muted max-[855px]:hidden`}>
            <span>Do tej pory</span>
            <span>Z wyjazdo</span>
          </div>
          <ul role="list" className="m-0 list-none p-0">
            {ROWS.map((r, i) => (
              <li key={i} className={`${row} py-5 ${i === ROWS.length - 1 ? "border-b" : ""}`}>
                <p className="m-0 text-ink-muted">
                  <span className="block text-sm font-semibold min-[856px]:sr-only">Do tej pory</span>
                  {r.before}
                </p>
                <p className="m-0">
                  <span className="block text-sm font-semibold text-moss min-[856px]:sr-only">Z wyjazdo</span>
                  {r.after}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

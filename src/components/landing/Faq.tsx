import { Container, SectionHeading } from "./shared";

export const FAQ = [
  {
    q: "Kiedy dostanę pieniądze?",
    a: "Wpłaty idą na Twoje konto u operatora płatności, a stamtąd na Twój rachunek. Wyjazdo ich nie przechowuje.",
  },
  {
    q: "Co, jeśli ktoś nie dopłaci?",
    a: "Dostaje trzy przypomnienia. Jeśli dalej nic, widzisz to na liście i możesz napisać jednym kliknięciem.",
  },
  {
    q: "A rezygnacje i zwroty?",
    a: "Obowiązuje Twój regulamin, który uczestniczka akceptuje przy zapisie. Zwrot robisz w panelu operatora płatności.",
  },
  {
    q: "Robię ten sam wyjazd kilka razy w roku.",
    a: "Duplikujesz wydarzenie i zmieniasz tylko daty. Opis, ceny i pytania zostają.",
  },
  {
    q: "Część osób woli zapłacić przelewem.",
    a: "Dopisujesz je ręcznie i zaznaczasz wpłatę. Miejsce znika z puli tak samo jak przy płatności online.",
  },
  {
    q: "Czy uczestniczki zakładają konto?",
    a: "Nie. Wszystko, czego potrzebują, dostają mailem.",
  },
];

export function Faq() {
  return (
    <section id="pytania" aria-labelledby="pytania-tytul" className="scroll-mt-4">
      <Container className="flex flex-wrap gap-x-[72px] gap-y-10 py-[88px]">
        <SectionHeading id="pytania-tytul" className="flex-[1_1_280px]">
          Pytania, które słyszymy najczęściej
        </SectionHeading>
        <dl className="m-0 grid flex-[2_1_520px] grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-x-10">
          {FAQ.map((item) => (
            <div key={item.q} className="border-t border-hairline py-[18px]">
              <dt className="font-bold">{item.q}</dt>
              <dd className="mt-1 mb-0 ml-0 text-ink-body">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

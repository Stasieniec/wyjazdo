import { Container, SectionHeading } from "./shared";

const STEPS = [
  {
    title: "Opisujesz wyjazd",
    body: "Daty, program, pokoje, co jest w cenie i jak dojechać. Dodajesz zdjęcia i swój regulamin.",
  },
  {
    title: "Ustawiasz cenę i zaliczkę",
    body: "Na przykład 1580 zł, 600 zł przy zapisie, reszta do 1 stycznia. Pokój jednoosobowy z dopłatą, jeśli go masz.",
  },
  {
    title: "Wklejasz link",
    body: "Na swoją stronę, na Facebooka, do maila. Każdy, kto kliknie, zapisuje się i płaci sam.",
  },
];

export function HowItWorks() {
  return (
    <section id="jak" aria-labelledby="jak-tytul" className="scroll-mt-4 bg-moss text-cream">
      <Container className="flex flex-col gap-8 pt-16 pb-20">
        <SectionHeading id="jak-tytul">Jak to działa</SectionHeading>
        <ol role="list" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-x-12 gap-y-8 p-0">
          {STEPS.map((step) => (
            <li key={step.title} className="flex flex-col gap-2 border-t border-[#A9B08A] pt-4">
              <h3 className="m-0 text-[21px] font-bold leading-[1.6]">{step.title}</h3>
              <p className="m-0 text-[#E9E6D8]">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

import type { ReactNode } from "react";
import { Container, SectionHeading } from "./shared";

type Row = { name: string; room: string; roommate: string; diet: string; paid: string; left: ReactNode };

const ROWS: Row[] = [
  {
    name: "Anna K.",
    room: "dwuosobowy",
    roommate: "Ewa S.",
    diet: "wegetariańska",
    paid: "1580 zł",
    left: <span className="font-semibold text-moss">opłacone</span>,
  },
  { name: "Ewa S.", room: "dwuosobowy", roommate: "Anna K.", diet: "bez glutenu", paid: "600 zł", left: "980 zł do 1 stycznia" },
  {
    name: "Marta W.",
    room: "jednoosobowy",
    roommate: "",
    diet: "z mięsem",
    paid: "600 zł",
    left: (
      <>
        <span className="font-bold text-terracotta">1280 zł, po terminie</span> ·{" "}
        <span className="font-semibold text-terracotta underline underline-offset-[3px]">przypomnij</span>
      </>
    ),
  },
  {
    name: "Joanna P.",
    room: "dwuosobowy",
    roommate: "Katarzyna M.",
    diet: "wegetariańska",
    paid: "1580 zł, przelew",
    left: <span className="font-semibold text-moss">opłacone</span>,
  },
];

const fakeButton =
  "rounded-full bg-cream px-4 py-[9px] text-[15px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-hairline)]";
const th = "border-b border-[#E6DCCB] px-5 py-3.5 font-medium";

export function ParticipantList() {
  return (
    <section aria-labelledby="lista-tytul">
      <Container className="flex flex-col gap-7 py-[88px]">
        <div className="flex flex-wrap items-end gap-x-[72px] gap-y-4">
          <SectionHeading id="lista-tytul" className="flex-[1_1_400px]">
            A Ty masz jedną listę
          </SectionHeading>
          <p className="m-0 flex-[1_1_400px] text-ink-body">
            Kto jedzie, z kim śpi, co je i ile jeszcze ma zapłacić. Osobę, która zapłaciła Ci przelewem albo zapisała
            się przez telefon, dopisujesz ręcznie.
          </p>
        </div>
        <figure className="m-0 overflow-hidden rounded-[20px] bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[#E6DCCB] px-5 py-[18px]">
            <figcaption className="font-heading text-xl">OdNowa · 12 z 16 miejsc</figcaption>
            <div aria-hidden="true" className="flex flex-wrap gap-2.5">
              <span className={fakeButton}>Dopisz osobę</span>
              <span className={fakeButton}>Pobierz do Excela</span>
            </div>
          </div>
          <div
            className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-terracotta"
            tabIndex={0}
            role="region"
            aria-label="Przykładowa lista uczestniczek, przewijana w poziomie"
          >
            <table className="w-full min-w-[700px] border-collapse text-base">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th scope="col" className={th}>Uczestniczka</th>
                  <th scope="col" className={th}>Pokój</th>
                  <th scope="col" className={th}>Współlokatorka</th>
                  <th scope="col" className={th}>Dieta</th>
                  <th scope="col" className={th}>Wpłacono</th>
                  <th scope="col" className={th}>Zostało</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => {
                  const td = `px-5 py-3.5 ${i < ROWS.length - 1 ? "border-b border-[#F1EADF]" : ""}`;
                  return (
                    <tr key={r.name}>
                      <th scope="row" className={`${td} text-left font-normal`}>{r.name}</th>
                      <td className={td}>{r.room}</td>
                      <td className={td}>{r.roommate}</td>
                      <td className={td}>{r.diet}</td>
                      <td className={td}>{r.paid}</td>
                      <td className={td}>{r.left}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </figure>
      </Container>
    </section>
  );
}

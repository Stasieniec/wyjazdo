import { Container, SectionHeading } from "./shared";

// TODO(owner): payment operator rate and the resulting amounts are not decided
// yet. The design keeps them as placeholders; replace all three before launch.
export const PRICING_PLACEHOLDERS = {
  rate: "[stawka]",
  fee: "[kwota]",
  payout: "[kwota]",
};

export function Pricing() {
  return (
    <section id="koszt" aria-labelledby="koszt-tytul" className="scroll-mt-4 bg-cream">
      <Container className="flex flex-wrap items-start gap-x-[72px] gap-y-10 py-[88px]">
        <div className="flex flex-[1_1_340px] flex-col gap-4">
          <SectionHeading id="koszt-tytul">Ile kosztuje</SectionHeading>
          <p className="m-0 text-ink-body">
            Wyjazdo nie bierze opłat za konto, strony ani maile. Płacisz tylko prowizję operatora płatności od każdej
            wpłaty online. Wpłaty przelewem, które dopisujesz sama, nic nie kosztują.
          </p>
        </div>
        <div className="flex flex-[1.2_1_440px] flex-col gap-3 rounded-[20px] bg-white px-5 py-[26px] shadow-[0_1px_0_#E0D4C0] sm:px-7">
          <p className="m-0 font-semibold">Przykład: weekend za 1580 zł, płatny w dwóch ratach</p>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5 text-[17px]">
            <dt className="text-ink-body">Zaliczka przy zapisie</dt>
            <dd className="m-0">600 zł</dd>
            <dt className="text-ink-body">Dopłata przed przyjazdem</dt>
            <dd className="m-0">980 zł</dd>
            <dt className="text-ink-body">Prowizja operatora, {PRICING_PLACEHOLDERS.rate}</dt>
            <dd className="m-0">{PRICING_PLACEHOLDERS.fee} zł</dd>
            <dt className="text-ink-body">Opłata wyjazdo</dt>
            <dd className="m-0">0 zł</dd>
            <dt className="border-t border-[#E6DCCB] pt-3 font-bold">Trafia na Twoje konto</dt>
            <dd className="m-0 border-t border-[#E6DCCB] pt-3 font-bold text-moss">{PRICING_PLACEHOLDERS.payout} zł</dd>
          </dl>
        </div>
      </Container>
    </section>
  );
}

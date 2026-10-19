import { CabinPhoto, StartLink, buttonStyles } from "./shared";

function HeroEventCard() {
  return (
    <figure
      aria-label="Przykładowa strona wyjazdu na telefonie"
      className="m-0 w-full max-w-[300px] rounded-[34px] bg-cream p-3 shadow-phone"
    >
      <div className="overflow-hidden rounded-[24px] bg-white">
        <CabinPhoto className="h-[180px]" priority />
        <div className="flex flex-col gap-2 p-[18px]">
          <span className="text-[13px] font-semibold text-moss">Chatka Zagajdzie</span>
          <span className="font-heading text-[22px] leading-[1.15]">OdNowa. Kobiecy weekend</span>
          <span className="text-sm text-ink-muted">15–17 stycznia 2027 · okolice Kazimierza Dolnego</span>
          <div className="mt-1 flex items-baseline justify-between border-t border-[#EEE5D6] pt-2.5">
            <span className="text-[22px] font-bold">1580 zł</span>
            <span className="text-[13px] text-ink-muted">zaliczka 600 zł</span>
          </div>
          <span className="rounded-full bg-terracotta p-[13px] text-center text-[15px] font-semibold text-white">
            Zapisz się
          </span>
        </div>
      </div>
    </figure>
  );
}

function Hills() {
  return (
    <svg
      width="100%"
      height="200"
      viewBox="0 0 1440 200"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="-mt-[120px] block h-[200px] w-full"
    >
      <path d="M0 110 C240 60 420 100 640 74 C860 48 1100 92 1440 56 L1440 200 L0 200 Z" fill="#C9C08A" />
      <path d="M0 146 C260 110 520 146 780 118 C1040 92 1240 128 1440 110 L1440 200 L0 200 Z" fill="#8C915A" />
      <path d="M0 178 C300 156 700 182 1040 160 C1220 148 1340 156 1440 150 L1440 200 L0 200 Z" fill="#5E6B3F" />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative">
      <div className="relative z-[1] mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] items-center gap-12 px-4 pt-10 pb-[110px] sm:px-6">
        <div className="flex flex-col gap-6">
          <span className="text-[15px] font-semibold text-moss">
            Dla organizatorek wyjazdów, retreatów i warsztatów
          </span>
          <h1 className="m-0 font-heading text-[clamp(40px,5.4vw,66px)] font-normal leading-[1.06] tracking-[-0.01em] text-balance">
            Zapisy i wpłaty na Twój wyjazd w jednym linku
          </h1>
          <p className="m-0 max-w-[520px] text-xl text-ink-body">
            Uczestniczki zapisują się i płacą BLIK-iem z telefonu. Ty widzisz, kto wpłacił zaliczkę, a komu
            przypomnieć o dopłacie.
          </p>
          <div className="flex flex-wrap gap-3">
            <StartLink label="Załóż stronę za darmo" className={`${buttonStyles.primary} px-7 py-4`} />
            <a href="#zapis" className={`${buttonStyles.secondary} px-[26px] py-4`}>
              Zobacz, jak to działa
            </a>
          </div>
        </div>
        <div className="relative z-[2] -mb-20 flex justify-center">
          <HeroEventCard />
        </div>
      </div>
      <Hills />
    </section>
  );
}

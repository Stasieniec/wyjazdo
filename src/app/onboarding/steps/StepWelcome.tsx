"use client";

type Props = {
  firstName: string | null;
  onStart: () => void;
};

const ITEMS = [
  "Nazwa i adres strony",
  "Email kontaktowy",
  "Krótki opis (opcjonalnie)",
  "Zgody i dokumenty",
];

export function StepWelcome({ firstName, onStart }: Props) {
  const greeting = firstName ? `Cześć ${firstName}!` : "Cześć!";
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-5xl">👋</div>
      <h1
        tabIndex={-1}
        className="mt-5 text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl"
      >
        {greeting} Skonfigurujmy Twoją stronę zapisów.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280] md:text-base">
        Zajmie to około 2 minuty. Krok po kroku przygotujemy wszystko, czego potrzebujesz.
      </p>

      <ul className="mt-6 flex flex-col gap-2.5">
        {ITEMS.map((item, i) => (
          <li key={item} className="flex items-center gap-3 text-sm font-medium text-[#1E3A5F] md:text-base">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-[#1E3A5F] text-xs font-bold text-white">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-10">
        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-2xl bg-[#E8683A] px-6 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(232,104,58,0.35)] transition active:scale-[0.99] md:max-w-xs"
        >
          Zaczynamy →
        </button>
      </div>
    </div>
  );
}

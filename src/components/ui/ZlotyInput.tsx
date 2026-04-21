"use client";
import { useEffect, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  valueCents: number;
  onChangeCents: (cents: number) => void;
};

function centsToZl(cents: number): string {
  if (cents === 0) return "0";
  return (cents / 100).toString().replace(".", ",");
}

function zlToCents(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  const normalized = trimmed.replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function ZlotyInput({ valueCents, onChangeCents, className = "", ...rest }: Props) {
  const [text, setText] = useState(() => centsToZl(valueCents));

  // If valueCents changes from outside (e.g., preset switch reset the types array)
  // and the current text doesn't parse to the new value, resync text from valueCents.
  useEffect(() => {
    const parsed = zlToCents(text);
    if (parsed !== valueCents) {
      setText(centsToZl(valueCents));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueCents]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        const cents = zlToCents(v);
        if (cents !== null) onChangeCents(cents);
      }}
      className={className}
      {...rest}
    />
  );
}

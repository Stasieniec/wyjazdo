"use client";

import { useState } from "react";

interface BrandColorPickerProps {
  name: string;
  label: string;
  defaultValue?: string | null;
  error?: string;
}

export function BrandColorPicker({ name, label, defaultValue, error }: BrandColorPickerProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const normalized = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#1E3A5F";

  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="mt-1 flex items-center gap-3">
        <input
          type="color"
          aria-label={label}
          value={normalized}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          className="h-10 w-14 shrink-0 cursor-pointer rounded-md border border-border bg-background p-1"
        />
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="#1E3A5F"
          pattern="#[0-9a-fA-F]{6}"
          className={`flex-1 rounded-lg border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${error ? "border-destructive" : "border-border"}`}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Kolor przycisku &bdquo;Zapisz się&rdquo; i&nbsp;akcentów na&nbsp;Twoich stronach.
      </p>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

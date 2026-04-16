import { type InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  error?: string;
}

export function Checkbox({ label, error, className = "", id, ...props }: CheckboxProps) {
  const inputId = id ?? props.name;
  return (
    <div>
      <label htmlFor={inputId} className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          id={inputId}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary ${error ? "accent-destructive" : ""} ${className}`}
          {...props}
        />
        <span className="text-foreground">{label}</span>
      </label>
      {error && <p className="mt-1 ml-7 text-sm text-destructive">{error}</p>}
    </div>
  );
}

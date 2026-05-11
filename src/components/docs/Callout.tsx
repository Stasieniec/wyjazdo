type Variant = "info" | "warning";

const STYLES: Record<Variant, { box: string; label: string; defaultLabel: string }> = {
  info: {
    box: "border-accent/40 bg-accent/8",
    label: "text-accent",
    defaultLabel: "Wskazówka",
  },
  warning: {
    box: "border-amber-300 bg-amber-50",
    label: "text-amber-700",
    defaultLabel: "Uwaga",
  },
};

export function Callout({
  variant = "info",
  label,
  children,
}: {
  variant?: Variant;
  label?: string;
  children: React.ReactNode;
}) {
  const style = STYLES[variant];
  return (
    <aside
      className={`my-6 rounded-xl border-l-4 px-5 py-4 text-sm leading-relaxed text-foreground ${style.box}`}
    >
      <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${style.label}`}>
        {label ?? style.defaultLabel}
      </p>
      {children}
    </aside>
  );
}

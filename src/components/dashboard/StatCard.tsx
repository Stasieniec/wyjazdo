interface StatCardProps {
  label: string;
  children: React.ReactNode;
  subtitle?: string;
  variant?: "default" | "navy";
  className?: string;
}

export function StatCard({
  label,
  children,
  subtitle,
  variant = "default",
  className = "",
}: StatCardProps) {
  const isNavy = variant === "navy";

  return (
    <div
      className={`rounded-xl p-4 sm:p-5 ${
        isNavy
          ? "bg-gradient-to-br from-primary to-[#2d5a8a] text-white"
          : "border border-border bg-background shadow-sm"
      } ${className}`}
    >
      <div
        className={`text-[10px] font-medium uppercase tracking-wider ${
          isNavy ? "text-white/70" : "text-muted-foreground"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${
          isNavy ? "text-white" : "text-primary"
        }`}
      >
        {children}
      </div>
      {subtitle && (
        <div
          className={`mt-1 text-xs ${
            isNavy ? "text-white/60" : "text-muted-foreground"
          }`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

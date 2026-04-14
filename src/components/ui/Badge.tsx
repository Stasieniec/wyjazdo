type Variant = "default" | "success" | "warning" | "destructive" | "info" | "accent";

const variantStyles: Record<Variant, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-amber-50 text-amber-700",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

const statusMap: Record<string, { variant: Variant; label: string }> = {
  paid: { variant: "success", label: "Opłacony" },
  pending: { variant: "warning", label: "Oczekuje" },
  cancelled: { variant: "default", label: "Anulowany" },
  refunded: { variant: "destructive", label: "Zwrócony" },
  waitlisted: { variant: "info", label: "Lista rezerwowa" },
  draft: { variant: "default", label: "Szkic" },
  published: { variant: "success", label: "Opublikowany" },
  archived: { variant: "default", label: "Zarchiwizowany" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusMap[status] ?? { variant: "default" as Variant, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

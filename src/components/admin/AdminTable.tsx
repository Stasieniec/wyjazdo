import type { ReactNode } from "react";

export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function AdminThead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </thead>
  );
}

export function AdminTh({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-3 py-2 ${className}`}>{children}</th>;
}

export function AdminTbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function AdminTr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`hover:bg-muted/30 ${className}`}>{children}</tr>;
}

export function AdminTd({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}

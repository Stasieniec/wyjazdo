import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Auth is enforced per-page (so /admin/login can opt out).
  return <div className="min-h-screen bg-muted/30">{children}</div>;
}

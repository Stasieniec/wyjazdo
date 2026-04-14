"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import type { ParticipantFilterStatus } from "@/lib/participantFilterStatus";

const FILTERS: { value: ParticipantFilterStatus; label: string }[] = [
  { value: "all", label: "Wszyscy" },
  { value: "paid", label: "Opłaceni" },
  { value: "pending", label: "Oczekujący" },
  { value: "cancelled", label: "Anulowani" },
];

export function ParticipantFilters({ current }: { current: ParticipantFilterStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setFilter(value: ParticipantFilterStatus) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {FILTERS.map(({ value, label }) => (
        <Button
          key={value}
          type="button"
          variant={current === value ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

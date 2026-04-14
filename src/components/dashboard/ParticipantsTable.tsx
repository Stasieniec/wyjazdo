import type { Participant } from "@/lib/db/schema";
import type { CustomQuestion } from "@/lib/validators/event";

export default function ParticipantsTable({
  participants,
  questions,
}: {
  participants: Participant[];
  questions: CustomQuestion[];
}) {
  if (participants.length === 0) {
    return <p className="mt-4 text-muted-foreground">Brak zgłoszeń.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Imię i nazwisko</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Telefon</th>
            <th className="py-2 pr-4">Zapłacono</th>
            {questions.map((q) => (
              <th key={q.id} className="py-2 pr-4">{q.label}</th>
            ))}
            <th className="py-2 pr-4">Data zapisu</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => {
            const answers: Record<string, string> = p.customAnswers
              ? JSON.parse(p.customAnswers)
              : {};
            return (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(p.status)}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-2 pr-4">{p.firstName} {p.lastName}</td>
                <td className="py-2 pr-4">{p.email}</td>
                <td className="py-2 pr-4">{p.phone ?? "—"}</td>
                <td className="py-2 pr-4">
                  {p.amountPaidCents != null ? (p.amountPaidCents / 100).toFixed(2) + " PLN" : "—"}
                </td>
                {questions.map((q) => (
                  <td key={q.id} className="py-2 pr-4 max-w-[16rem] truncate">
                    {answers[q.id] ?? "—"}
                  </td>
                ))}
                <td className="py-2 pr-4">
                  {new Date(p.createdAt).toLocaleString("pl-PL")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "waitlisted": return "bg-blue-100 text-blue-800";
    case "cancelled": return "bg-neutral-100 text-neutral-600";
    case "refunded": return "bg-purple-100 text-purple-800";
    default: return "bg-neutral-100 text-neutral-600";
  }
}

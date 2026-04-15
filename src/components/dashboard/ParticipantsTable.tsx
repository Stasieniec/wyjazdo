import type { Participant, Payment } from "@/lib/db/schema";
import { derivedStatus, type DerivedStatus } from "@/lib/participant-status";
import type { CustomQuestion } from "@/lib/validators/event";

export default function ParticipantsTable({
  participants,
  payments,
  questions,
  emptyMessage,
}: {
  participants: Participant[];
  /** All payments for ALL participants passed in, keyed implicitly by participantId. */
  payments: Payment[];
  questions: CustomQuestion[];
  /** When set (e.g. filtered list), shown instead of the default "Brak zgłoszeń." */
  emptyMessage?: string;
}) {
  if (participants.length === 0) {
    return (
      <p className="mt-4 text-muted-foreground">{emptyMessage ?? "Brak zgłoszeń."}</p>
    );
  }

  const now = Date.now();
  const paymentsByParticipant = new Map<string, Payment[]>();
  for (const pay of payments) {
    const list = paymentsByParticipant.get(pay.participantId) ?? [];
    list.push(pay);
    paymentsByParticipant.set(pay.participantId, list);
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-4">Status</th>
            <th scope="col" className="py-2 pr-4">Imię i nazwisko</th>
            <th scope="col" className="py-2 pr-4">Email</th>
            <th scope="col" className="py-2 pr-4">Telefon</th>
            <th scope="col" className="py-2 pr-4">Zapłacono</th>
            {questions.map((q) => (
              <th key={q.id} scope="col" className="py-2 pr-4">{q.label}</th>
            ))}
            <th scope="col" className="py-2 pr-4">Data zapisu</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => {
            const answers: Record<string, string> = p.customAnswers
              ? JSON.parse(p.customAnswers)
              : {};
            const participantPayments = paymentsByParticipant.get(p.id) ?? [];
            const ds = derivedStatus(p, participantPayments, now);
            const totalPaidCents = participantPayments
              .filter((pay) => pay.status === "succeeded")
              .reduce((sum, pay) => sum + pay.amountCents, 0);

            return (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(ds)}`}>
                    {ds}
                  </span>
                </td>
                <td className="py-2 pr-4">{p.firstName} {p.lastName}</td>
                <td className="py-2 pr-4">{p.email}</td>
                <td className="py-2 pr-4">{p.phone ?? "—"}</td>
                <td className="py-2 pr-4">
                  {totalPaidCents > 0 ? (totalPaidCents / 100).toFixed(2) + " PLN" : "—"}
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

function statusColor(status: DerivedStatus): string {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "deposit_paid": return "bg-emerald-100 text-emerald-700";
    case "overdue": return "bg-orange-100 text-orange-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "waitlisted": return "bg-blue-100 text-blue-800";
    case "cancelled": return "bg-neutral-100 text-neutral-600";
    case "refunded": return "bg-purple-100 text-purple-800";
    default: return "bg-neutral-100 text-neutral-600";
  }
}

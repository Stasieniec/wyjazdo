"use client";

import { Fragment, useState } from "react";
import type { Participant, Payment, ParticipantConsent } from "@/lib/db/schema";
import { derivedStatus, type DerivedStatus } from "@/lib/participant-status";
import type { CustomQuestion } from "@/lib/validators/event";
import { extendBalanceDeadlineAction, cancelAndFreeSpotAction } from "@/app/dashboard/events/[id]/actions";
import { formatPlnFromCents } from "@/lib/format-currency";

export default function ParticipantsTable({
  participants,
  payments,
  consents,
  questions,
  emptyMessage,
}: {
  participants: Participant[];
  /** All payments for ALL participants passed in, keyed implicitly by participantId. */
  payments: Payment[];
  consents?: ParticipantConsent[];
  questions: CustomQuestion[];
  /** When set (e.g. filtered list), shown instead of the default "Brak zgłoszeń." */
  emptyMessage?: string;
}) {
  const [expandedConsents, setExpandedConsents] = useState<Set<string>>(new Set());

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

  const consentsByParticipant = new Map<string, ParticipantConsent[]>();
  for (const c of (consents ?? [])) {
    const list = consentsByParticipant.get(c.participantId) ?? [];
    list.push(c);
    consentsByParticipant.set(c.participantId, list);
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
            <th scope="col" className="py-2 pr-4">Akcje</th>
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
            const balancePayment = participantPayments.find((pay) => pay.kind === "balance");
            const participantConsents = consentsByParticipant.get(p.id) ?? [];

            return (
              <Fragment key={p.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(ds)}`}>
                      {ds}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{p.firstName} {p.lastName}</td>
                  <td className="py-2 pr-4">{p.email}</td>
                  <td className="py-2 pr-4">{p.phone ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {totalPaidCents > 0 ? formatPlnFromCents(totalPaidCents) : "—"}
                  </td>
                  {questions.map((q) => (
                    <td key={q.id} className="py-2 pr-4 max-w-[16rem] truncate">
                      {answers[q.id] ?? "—"}
                    </td>
                  ))}
                  <td className="py-2 pr-4">
                    {new Date(p.createdAt).toLocaleString("pl-PL")}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-col gap-2">
                      {participantConsents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedConsents((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          })}
                          className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                        >
                          Zgody ({participantConsents.length})
                        </button>
                      )}
                      {ds === "overdue" && balancePayment && (
                        <>
                          <form action={extendBalanceDeadlineAction} className="flex items-center gap-1">
                            <input type="hidden" name="paymentId" value={balancePayment.id} />
                            <input
                              type="datetime-local"
                              name="dueAt"
                              required
                              className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button
                              type="submit"
                              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                            >
                              Przedłuż termin
                            </button>
                          </form>
                          <form
                            action={cancelAndFreeSpotAction}
                            onSubmit={(e) => {
                              if (!window.confirm(`Anulować uczestnika ${p.firstName} ${p.lastName} i zwolnić miejsce?`)) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="participantId" value={p.id} />
                            <button
                              type="submit"
                              className="rounded border border-destructive/40 bg-background px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                            >
                              Anuluj i zwolnij miejsce
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedConsents.has(p.id) && participantConsents.length > 0 && (
                  <tr>
                    <td colSpan={7 + questions.length} className="bg-muted/30 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                        Zgody udzielone przy rejestracji
                      </p>
                      <ul className="space-y-1 text-sm">
                        {participantConsents.map((c) => (
                          <li key={c.id} className="flex items-center gap-2">
                            {c.accepted ? (
                              <span className="text-green-600">&#10003;</span>
                            ) : (
                              <span className="text-muted-foreground">&#8212;</span>
                            )}
                            <span>{c.consentLabel}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {new Date(c.acceptedAt).toLocaleDateString("pl-PL")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
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

"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { Attendee, Participant, Payment, ParticipantConsent } from "@/lib/db/schema";
import { derivedStatus, type DerivedStatus } from "@/lib/participant-status";
import type { CustomQuestion } from "@/lib/validators/event";
import type { AttendeeType } from "@/lib/validators/attendee-types";
import {
  extendBalanceDeadlineAction,
  cancelParticipantAction,
  promoteFromWaitlistAction,
  resendPaymentLinkAction,
  removeAttendeeAction,
} from "@/app/dashboard/events/[id]/actions";
import { formatPlnFromCents } from "@/lib/format-currency";
import { RemoveAttendeeDialog } from "@/app/dashboard/events/[id]/participants/RemoveAttendeeDialog";

type AttendeeWithTypeName = Attendee & { typeName: string };

type RemovalTarget = {
  participantId: string;
  registrantName: string;
  attendee: AttendeeWithTypeName;
  remaining: AttendeeWithTypeName[];
  paidCents: number;
};

export default function ParticipantsTable({
  participants,
  payments,
  consents,
  questions,
  emptyMessage,
  attendeesByParticipant = {},
  attendeeTypes = [],
  remainingCapacity = 0,
}: {
  participants: Participant[];
  /** All payments for ALL participants passed in, keyed implicitly by participantId. */
  payments: Payment[];
  consents?: ParticipantConsent[];
  questions: CustomQuestion[];
  /** When set (e.g. filtered list), shown instead of the default "Brak zgłoszeń." */
  emptyMessage?: string;
  /** Active + cancelled attendees keyed by participantId. Empty for legacy participants. */
  attendeesByParticipant?: Record<string, AttendeeWithTypeName[]>;
  /** Attendee type config, needed by the removal dialog for refund calc. */
  attendeeTypes?: AttendeeType[];
  /** Remaining free capacity, shown in the removal dialog. */
  remainingCapacity?: number;
}) {
  const router = useRouter();
  const [expandedConsents, setExpandedConsents] = useState<Set<string>>(new Set());
  const [expandedAttendees, setExpandedAttendees] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<RemovalTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Leftmost "expand" column + existing columns
  const totalCols = 8 + questions.length;

  async function handleConfirmRemoval() {
    if (!removing || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("attendeeId", removing.attendee.id);
      fd.set("participantId", removing.participantId);
      await removeAttendeeAction(fd);
      setRemoving(null);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-2 w-6" aria-label="Rozwiń" />
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

            const allAttendees = attendeesByParticipant[p.id] ?? [];
            const activeAttendees = allAttendees.filter((a) => a.cancelledAt == null);
            const hasExpandableAttendees = activeAttendees.length > 1;
            const isExpanded = expandedAttendees.has(p.id);
            const canRemovePerAttendee =
              hasExpandableAttendees && ds !== "waitlisted" && ds !== "cancelled" && ds !== "refunded";

            return (
              <Fragment key={p.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="py-2 pr-2 align-top">
                    {hasExpandableAttendees ? (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Zwiń listę uczestników" : "Rozwiń listę uczestników"}
                        onClick={() =>
                          setExpandedAttendees((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          })
                        }
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <span aria-hidden className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                          &#x25B8;
                        </span>
                      </button>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(ds)}`}>
                      {ds}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span>{p.firstName} {p.lastName}</span>
                    {hasExpandableAttendees && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {activeAttendees.length} {pluralOsoby(activeAttendees.length)}
                      </span>
                    )}
                  </td>
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

                      {/* Cancel — any non-terminal status */}
                      {ds !== "cancelled" && ds !== "refunded" && (
                        <form
                          action={cancelParticipantAction}
                          onSubmit={(e) => {
                            const hasPaid = ds === "paid" || ds === "deposit_paid" || ds === "overdue";
                            const msg = hasPaid
                              ? `Czy na pewno chcesz anulować uczestnika ${p.firstName} ${p.lastName}? Uczestnik dokonał płatności — zwrot środków należy wykonać ręcznie przez panel Stripe.`
                              : `Czy na pewno chcesz anulować uczestnika ${p.firstName} ${p.lastName}?`;
                            if (!window.confirm(msg)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="participantId" value={p.id} />
                          <button
                            type="submit"
                            className="rounded border border-destructive/40 bg-background px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                          >
                            Anuluj
                          </button>
                        </form>
                      )}

                      {/* Promote from waitlist */}
                      {ds === "waitlisted" && (
                        <form action={promoteFromWaitlistAction}>
                          <input type="hidden" name="participantId" value={p.id} />
                          <div className="flex items-center gap-1">
                            <input
                              type="datetime-local"
                              name="expiresAt"
                              required
                              className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button
                              type="submit"
                              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                            >
                              Przenieś z listy
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Extend balance deadline — overdue with balance payment */}
                      {ds === "overdue" && balancePayment && (
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
                      )}

                      {/* Resend payment link — active lifecycle, no succeeded payments */}
                      {p.lifecycleStatus === "active" && !participantPayments.some((pay) => pay.status === "succeeded") && ds !== "cancelled" && (
                        <form
                          action={resendPaymentLinkAction}
                          onSubmit={(e) => {
                            if (!window.confirm(`Wyślić ponownie link do płatności dla ${p.firstName} ${p.lastName}?`)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="participantId" value={p.id} />
                          <button
                            type="submit"
                            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                          >
                            Wyślij link do płatności
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && hasExpandableAttendees && (
                  <tr className="bg-muted/30">
                    <td colSpan={totalCols} className="px-4 py-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Uczestnicy ({activeAttendees.length})
                      </p>
                      <ul className="space-y-1 text-sm">
                        {activeAttendees.map((a) => (
                          <li key={a.id} className="flex items-center gap-2">
                            <span>{a.firstName} {a.lastName}</span>
                            <span className="text-muted-foreground">({a.typeName})</span>
                            {canRemovePerAttendee && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRemoving({
                                    participantId: p.id,
                                    registrantName: `${p.firstName} ${p.lastName}`,
                                    attendee: a,
                                    remaining: activeAttendees.filter((x) => x.id !== a.id),
                                    paidCents: totalPaidCents,
                                  })
                                }
                                className="ml-auto rounded border border-destructive/40 bg-background px-2 py-0.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
                              >
                                Usuń uczestnika
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
                {expandedConsents.has(p.id) && participantConsents.length > 0 && (
                  <tr>
                    <td colSpan={totalCols} className="bg-muted/30 px-4 py-3">
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
      {removing && (
        <RemoveAttendeeDialog
          registrantName={removing.registrantName}
          attendeeToRemove={removing.attendee}
          remainingAttendees={removing.remaining}
          attendeeTypes={attendeeTypes}
          paidCents={removing.paidCents}
          remainingCapacity={remainingCapacity}
          onConfirm={handleConfirmRemoval}
          onCancel={() => {
            if (!isSubmitting) setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

function statusColor(status: DerivedStatus): string {
  switch (status) {
    case "paid": return "bg-success/10 text-success";
    case "deposit_paid": return "bg-success/10 text-success";
    case "overdue": return "bg-amber-50 text-amber-700";
    case "pending": return "bg-amber-50 text-amber-700";
    case "waitlisted": return "bg-primary/10 text-primary";
    case "cancelled": return "bg-muted text-muted-foreground";
    case "refunded": return "bg-destructive/10 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

function pluralOsoby(n: number): string {
  // Polish pluralization for "osoba"
  // 1 osoba, 2-4 osoby, 5+ osób; and 12-14 osób (teens)
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "osoba";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "osoby";
  return "osób";
}

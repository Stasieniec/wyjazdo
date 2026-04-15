import { and, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { derivedStatus, type PaymentLike } from "@/lib/participant-status";
import { shouldSendReminder } from "@/lib/balance-reminders";
import { ensureBalancePayment } from "@/lib/register/ensure-balance-payment";
import { sendBalanceReminder } from "@/lib/email/send";
import {
  listPaymentsForParticipants,
  setPaymentLastReminderAt,
} from "@/lib/db/queries/payments";
import {
  signParticipantToken,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";

export async function runBalanceReminders(): Promise<{ sent: number; considered: number }> {
  const db = getDb();
  const now = Date.now();

  const rows = await db
    .select({
      participant: schema.participants,
      event: schema.events,
      organizer: schema.organizers,
    })
    .from(schema.participants)
    .innerJoin(schema.events, eq(schema.participants.eventId, schema.events.id))
    .innerJoin(schema.organizers, eq(schema.events.organizerId, schema.organizers.id))
    .where(
      and(
        eq(schema.participants.lifecycleStatus, "active"),
        isNotNull(schema.events.depositCents),
      ),
    );

  const pids = rows.map((r) => r.participant.id);
  const allPayments = await listPaymentsForParticipants(pids);
  const byPid = new Map<string, typeof allPayments>();
  for (const p of allPayments) {
    const list = byPid.get(p.participantId) ?? [];
    list.push(p);
    byPid.set(p.participantId, list);
  }

  const secret = getParticipantAuthSecret();
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  let sent = 0;
  for (const r of rows) {
    const pmts = byPid.get(r.participant.id) ?? [];
    const status = derivedStatus(
      { lifecycleStatus: r.participant.lifecycleStatus },
      pmts.map((p) => ({
        kind: p.kind as PaymentLike["kind"],
        status: p.status as PaymentLike["status"],
        dueAt: p.dueAt,
      })),
      now,
    );
    if (status !== "deposit_paid") continue;
    if (r.event.balanceDueAt == null) continue;

    const balance = pmts.find((p) => p.kind === "balance");
    const dueAtMs = balance?.dueAt ?? r.event.balanceDueAt;
    const lastReminderAt = balance?.lastReminderAt ?? null;
    if (!shouldSendReminder({ nowMs: now, dueAtMs, lastReminderAt })) continue;

    try {
      await ensureBalancePayment({
        participant: r.participant,
        event: r.event,
        organizer: r.organizer,
        origin: `${proto}//${host}`,
      });

      // After ensureBalancePayment, the balance payment row exists. Re-read:
      const refreshed = await listPaymentsForParticipants([r.participant.id]);
      const b = refreshed.find((p) => p.kind === "balance");
      if (!b) continue;

      const token = await signParticipantToken(r.participant.id, secret);
      const tripUrl = `${proto}//${host}/my-trips/${r.participant.id}?t=${encodeURIComponent(token)}`;

      await sendBalanceReminder({
        to: r.participant.email,
        participantName: r.participant.firstName,
        eventTitle: r.event.title,
        amountPln: (b.amountCents / 100).toFixed(2),
        dueDate: new Date(dueAtMs).toLocaleDateString("pl-PL"),
        payUrl: tripUrl,
        organizerName: r.organizer.displayName,
      });
      await setPaymentLastReminderAt(b.id, now);
      sent += 1;
    } catch (err) {
      console.error("reminder send failed for", r.participant.id, err);
    }
  }

  return { sent, considered: rows.length };
}

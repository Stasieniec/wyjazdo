import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { getEventForOrganizer } from "@/lib/db/queries/events-dashboard";
import { listParticipantsForEvent } from "@/lib/db/queries/participants";
import { listPaymentsForParticipants } from "@/lib/db/queries/payments";
import { derivedStatus } from "@/lib/participant-status";
import type { CustomQuestion } from "@/lib/validators/event";
import { toCsvRow } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) return new Response("No organizer", { status: 403 });
  const event = await getEventForOrganizer(organizer.id, id);
  if (!event) return new Response("Not found", { status: 404 });

  const questions: CustomQuestion[] = event.customQuestions
    ? JSON.parse(event.customQuestions)
    : [];
  const participants = await listParticipantsForEvent(event.id);
  const payments = await listPaymentsForParticipants(participants.map((p) => p.id));
  const now = Date.now();

  // Group payments by participantId
  const paymentsByParticipant = new Map<string, typeof payments>();
  for (const pay of payments) {
    const list = paymentsByParticipant.get(pay.participantId) ?? [];
    list.push(pay);
    paymentsByParticipant.set(pay.participantId, list);
  }

  const headers = [
    "status",
    "first_name",
    "last_name",
    "email",
    "phone",
    "created_at",
    "paid_at",
    "amount_paid_pln",
    ...questions.map((q) => q.label),
  ];

  const lines: string[] = [toCsvRow(headers)];
  for (const p of participants) {
    const answers: Record<string, string> = p.customAnswers
      ? JSON.parse(p.customAnswers)
      : {};
    const participantPayments = paymentsByParticipant.get(p.id) ?? [];
    const ds = derivedStatus(p, participantPayments, now);
    const succeededPayments = participantPayments.filter((pay) => pay.status === "succeeded");
    const totalPaidCents = succeededPayments.reduce((sum, pay) => sum + pay.amountCents, 0);
    const latestPaidAt = succeededPayments
      .map((pay) => pay.paidAt)
      .filter((t): t is number => t !== null)
      .sort((a, b) => b - a)[0] ?? null;

    lines.push(
      toCsvRow([
        ds,
        p.firstName,
        p.lastName,
        p.email,
        p.phone,
        new Date(p.createdAt).toISOString(),
        latestPaidAt ? new Date(latestPaidAt).toISOString() : null,
        totalPaidCents > 0 ? (totalPaidCents / 100).toFixed(2) : null,
        ...questions.map((q) => answers[q.id] ?? ""),
      ]),
    );
  }

  const filename = `${event.slug}-participants-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

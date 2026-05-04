"use client";

import Link from "next/link";
import { changeStatusAction } from "./actions";

type Props = {
  eventId: string;
  eventStatus: "draft" | "published" | "archived";
  stripeReady: boolean;
  publishable: boolean;
  missing: string[];
};

export function PublishControls({
  eventId,
  eventStatus,
  stripeReady,
  publishable,
  missing,
}: Props) {
  const publishBound = changeStatusAction.bind(null, eventId, "published");
  const unpublishBound = changeStatusAction.bind(null, eventId, "draft");
  const archiveBound = changeStatusAction.bind(null, eventId, "archived");
  const canPublish = publishable && stripeReady;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Status: {statusLabel(eventStatus)}
      </p>
      {eventStatus === "published" ? (
        <form action={unpublishBound}>
          <button
            type="submit"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            Ukryj (cofnij publikację)
          </button>
        </form>
      ) : (
        <>
          <form action={publishBound}>
            <button
              type="submit"
              disabled={!canPublish}
              title={
                !stripeReady
                  ? "Dokończ konfigurację Stripe, aby opublikować"
                  : !publishable
                  ? `Brakuje: ${missing.join(", ")}`
                  : undefined
              }
              className="w-full rounded-md bg-[#E8683A] px-3 py-2 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Opublikuj
            </button>
          </form>
          {!stripeReady && (
            <Link
              href="/dashboard/onboarding/payouts"
              className="block text-center text-xs text-yellow-700 underline"
            >
              Dokończ konfigurację Stripe
            </Link>
          )}
        </>
      )}
      {eventStatus !== "archived" && (
        <form action={archiveBound}>
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Archiwizuj
          </button>
        </form>
      )}
    </div>
  );
}

function statusLabel(s: "draft" | "published" | "archived"): string {
  if (s === "draft") return "Szkic";
  if (s === "published") return "Opublikowane";
  return "Zarchiwizowane";
}

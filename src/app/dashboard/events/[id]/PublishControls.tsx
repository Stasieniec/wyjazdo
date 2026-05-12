"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { changeStatusAction } from "./actions";

type Props = {
  eventId: string;
  eventStatus: "draft" | "published" | "archived";
  stripeReady: boolean;
  publishable: boolean;
  missing: string[];
  previewUrl: string;
};

export function PublishControls({
  eventId,
  eventStatus,
  stripeReady,
  publishable,
  missing,
  previewUrl,
}: Props) {
  const publishBound = changeStatusAction.bind(null, eventId, "published");
  const unpublishBound = changeStatusAction.bind(null, eventId, "draft");
  const archiveBound = changeStatusAction.bind(null, eventId, "archived");
  const canPublish = publishable && stripeReady;

  // Adjust state when a prop changes (React docs pattern):
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // We open the dialog once on the transition from non-published → published.
  const [showPublishedDialog, setShowPublishedDialog] = useState(false);
  const [prevEventStatus, setPrevEventStatus] = useState(eventStatus);
  if (prevEventStatus !== eventStatus) {
    setPrevEventStatus(eventStatus);
    if (prevEventStatus !== "published" && eventStatus === "published") {
      setShowPublishedDialog(true);
    }
  }

  return (
    <>
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

      {showPublishedDialog && (
        <PublishedDialog
          eventId={eventId}
          previewUrl={previewUrl}
          onClose={() => setShowPublishedDialog(false)}
        />
      )}
    </>
  );
}

function statusLabel(s: "draft" | "published" | "archived"): string {
  if (s === "draft") return "Szkic";
  if (s === "published") return "Opublikowane";
  return "Zarchiwizowane";
}

function PublishedDialog({
  eventId,
  previewUrl,
  onClose,
}: {
  eventId: string;
  previewUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = previewUrl;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="published-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-6 w-6"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 111.42-1.42L8 12.59l7.29-7.3a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 id="published-dialog-title" className="text-xl font-bold text-foreground">
              Wydarzenie opublikowane!
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gratulacje — Twoje wydarzenie jest teraz widoczne dla uczestników.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-foreground">
            Link do wydarzenia — udostępnij go uczestnikom:
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              title={previewUrl}
            >
              {previewUrl.replace(/^https?:\/\//, "")}
            </a>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent/90"
            >
              {copied ? "Skopiowano ✓" : "Skopiuj"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Gdzie znajdę ten link później?</strong>{" "}
            Zawsze tu, na górze tej strony — obok statusu wydarzenia (przycisk „Podgląd”
            i „Skopiuj link”).
          </p>
          <p>
            <strong className="text-foreground">Gdzie zobaczę nowe zapisy?</strong>{" "}
            W zakładce{" "}
            <Link
              href={`/dashboard/events/${eventId}?tab=uczestnicy`}
              className="text-primary underline underline-offset-2"
            >
              Uczestnicy
            </Link>
            . Otrzymasz też e-mail przy każdym nowym zgłoszeniu.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-[#E8683A] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 sm:w-auto"
          >
            Świetnie, dzięki
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted sm:w-auto"
          >
            Otwórz podgląd
          </a>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { requestCallbackAction } from "@/app/actions";
import type { CallbackFormState } from "@/lib/leads/submit";
import { CheckBadge } from "./shared";

// TODO(owner): decide how soon we promise to get back to people, then replace
// "[kiedy]" (e.g. "w ciągu jednego dnia roboczego"). Shown in the thank-you state.
export const CALLBACK_RESPONSE_TIME = "[kiedy]";

const INITIAL: CallbackFormState = { status: "idle" };

const input =
  "w-full rounded-xl border border-[#8C7F72] bg-white px-3.5 py-[13px] text-lg font-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta aria-[invalid=true]:border-terracotta";

export function CallbackDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  // Bumped on every open so the form (and its action state) starts fresh.
  const [session, setSession] = useState(0);
  const pressedOnBackdrop = useRef(false);

  function open() {
    setSession((s) => s + 1);
    document.documentElement.style.overflow = "hidden";
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      document.documentElement.style.overflow = "";
      openerRef.current?.focus();
    };
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("close", onClose);
      // Leaving the page from inside the dialog (the privacy link) unmounts it without a close event.
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="cursor-pointer rounded-full border-0 bg-cream px-8 py-[18px] text-[19px] font-semibold text-ink hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
      >
        Poproś o kontakt
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="kontakt-tytul"
        // A press and release on the dialog element itself is a click on the backdrop.
        // Both ends are checked so a text selection dragged out of an input does not close it.
        onPointerDown={(e) => {
          pressedOnBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (pressedOnBackdrop.current && e.target === e.currentTarget) close();
          pressedOnBackdrop.current = false;
        }}
        className="m-auto w-[calc(100%-32px)] max-w-[460px] rounded-[24px] border-0 bg-cream p-0 text-ink shadow-dialog backdrop:bg-[rgba(43,36,32,0.55)]"
      >
        <div className="relative flex flex-col gap-4 p-6 sm:p-7">
          <button
            type="button"
            onClick={close}
            aria-label="Zamknij"
            className="absolute top-3.5 right-3.5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent hover:bg-sand focus-visible:outline-2 focus-visible:outline-terracotta"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3 3 L15 15 M15 3 L3 15" stroke="#2B2420" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {session > 0 ? <CallbackForm key={session} onClose={close} /> : null}
        </div>
      </dialog>
    </>
  );
}

function CallbackForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(requestCallbackAction, INITIAL);
  const ids = useId();
  const contactId = `${ids}-contact`;
  const contactErrorId = `${ids}-contact-error`;
  const nameId = `${ids}-name`;
  const nameErrorId = `${ids}-name-error`;
  const doneRef = useRef<HTMLHeadingElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);

  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : { contact: "", name: "" };

  useEffect(() => {
    if (state.status === "success") doneRef.current?.focus();
    else if (state.status === "error" && state.fieldErrors.contact) contactRef.current?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-3.5 py-2">
        <CheckBadge />
        <h2
          id="kontakt-tytul"
          ref={doneRef}
          tabIndex={-1}
          aria-describedby={`${ids}-done`}
          className="m-0 font-heading text-[28px] font-normal leading-[1.15] outline-none"
        >
          Dziękujemy
        </h2>
        <p id={`${ids}-done`} className="m-0 text-[17px] text-ink-body">
          Odezwiemy się {CALLBACK_RESPONSE_TIME}. Jeśli wolisz od razu, napisz na{" "}
          <a href="mailto:kontakt@wyjazdo.pl" className="text-terracotta underline underline-offset-[3px]">
            kontakt@wyjazdo.pl
          </a>
          .
        </p>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer self-start rounded-full border-0 bg-white px-6 py-3 text-[17px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-hairline)] hover:bg-oat focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          Zamknij
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        // aria-disabled instead of disabled keeps focus on the button while sending.
        if (pending) e.preventDefault();
      }}
      className="flex flex-col gap-4"
    >
      <h2 id="kontakt-tytul" className="m-0 pr-10 font-heading text-[28px] font-normal leading-[1.15]">
        Zadzwonimy albo napiszemy
      </h2>
      <p className="m-0 text-[17px] text-ink-body">
        Zostaw numer albo e-mail. Umówimy się na krótką rozmowę i założymy z Tobą pierwszą stronę.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={contactId} className="text-[15px] font-semibold">
          Telefon lub e-mail
        </label>
        <input
          ref={contactRef}
          id={contactId}
          name="contact"
          type="text"
          autoFocus
          placeholder="np. 600 100 200"
          required
          maxLength={200}
          defaultValue={values.contact}
          aria-invalid={errors.contact ? true : undefined}
          aria-describedby={errors.contact ? contactErrorId : undefined}
          className={input}
        />
        {errors.contact ? (
          <p id={contactErrorId} className="m-0 text-[15px] font-medium text-terracotta">
            {errors.contact}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={nameId} className="text-[15px] font-semibold">
          Imię <span className="font-normal text-ink-muted">(opcjonalnie)</span>
        </label>
        <input
          id={nameId}
          name="name"
          type="text"
          autoComplete="given-name"
          maxLength={100}
          defaultValue={values.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? nameErrorId : undefined}
          className={input}
        />
        {errors.name ? (
          <p id={nameErrorId} className="m-0 text-[15px] font-medium text-terracotta">
            {errors.name}
          </p>
        ) : null}
      </div>
      {/* Left empty by people; bots that fill every field are ignored. */}
      <div aria-hidden="true" className="sr-only">
        <label>
          Strona www
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {state.status === "error" && state.formError ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-terracotta">
          {state.formError}
        </p>
      ) : null}
      <button
        type="submit"
        aria-disabled={pending}
        className="cursor-pointer rounded-full border-0 bg-terracotta px-7 py-[15px] text-lg font-semibold text-white hover:bg-terracotta-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta aria-disabled:cursor-wait aria-disabled:opacity-70"
      >
        {pending ? "Wysyłam…" : "Poproś o kontakt"}
      </button>
      <p className="m-0 text-[13px] leading-[1.45] text-ink-muted">
        Wysyłając, zgadzasz się, żebyśmy skontaktowali się z Tobą w sprawie wyjazdo. Szczegóły w{" "}
        <Link href="/polityka-prywatnosci" className="text-terracotta underline underline-offset-[3px] hover:text-terracotta-dark">
          polityce prywatności
        </Link>
        .
      </p>
    </form>
  );
}

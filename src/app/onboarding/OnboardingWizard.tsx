"use client";

import { useState, useTransition } from "react";
import { createOrganizerAction } from "./actions";
import { slugify } from "@/lib/utils/slug";
import { WizardShell } from "./WizardShell";
import { StepWelcome } from "./steps/StepWelcome";
import { StepName } from "./steps/StepName";
import { StepSubdomain } from "./steps/StepSubdomain";
import { StepEmail } from "./steps/StepEmail";
import { StepDescription } from "./steps/StepDescription";
import { StepConsents } from "./steps/StepConsents";

type Props = {
  firstName: string | null;
  defaultContactEmail: string;
};

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;
const TOTAL_INPUT_STEPS = 5;

type FieldErrors = {
  displayName?: string;
  subdomain?: string;
  contactEmail?: string;
  description?: string;
  consents?: string;
};

// Map a step index to the FieldErrors key shown on that step's screen.
const STEP_TO_FIELD: Record<number, keyof FieldErrors> = {
  1: "displayName",
  2: "subdomain",
  3: "contactEmail",
  4: "description",
  5: "consents",
};

export function OnboardingWizard({ firstName, defaultContactEmail }: Props) {
  const [step, setStep] = useState<StepIndex>(0);
  const [displayName, setDisplayName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainEditedManually, setSubdomainEditedManually] = useState(false);
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [description, setDescription] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptDpa, setAcceptDpa] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function clearErrors() {
    setErrors({});
  }

  function goTo(next: StepIndex) {
    clearErrors();
    setStep(next);
  }

  function back() {
    if (step > 0) goTo((step - 1) as StepIndex);
  }

  // ----- Per-step "Dalej" handlers with client validation -----

  function handleNameNext() {
    const trimmed = displayName.trim();
    if (trimmed.length < 1) {
      setErrors({ displayName: "Wpisz nazwę swojej firmy" });
      return;
    }
    if (trimmed.length > 100) {
      setErrors({ displayName: "Nazwa może mieć maks. 100 znaków" });
      return;
    }
    // Auto-suggest subdomain if user hasn't edited it manually yet.
    if (!subdomainEditedManually) {
      setSubdomain(slugify(trimmed));
    }
    goTo(2);
  }

  function handleSubdomainChange(next: string) {
    setSubdomainEditedManually(true);
    setSubdomain(next);
  }

  function handleSubdomainNext() {
    const value = subdomain.trim();
    if (value.length < 3 || value.length > 32) {
      setErrors({ subdomain: "Adres musi mieć od 3 do 32 znaków" });
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)) {
      setErrors({ subdomain: "Adres może zawierać tylko małe litery, cyfry i myślniki" });
      return;
    }
    goTo(3);
  }

  function handleEmailNext() {
    const value = contactEmail.trim();
    // Pragmatic email regex: anything@anything.tld
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErrors({ contactEmail: "Wpisz prawidłowy adres email" });
      return;
    }
    if (value.length > 200) {
      setErrors({ contactEmail: "Email może mieć maks. 200 znaków" });
      return;
    }
    goTo(4);
  }

  function handleDescriptionNext() {
    if (description.length > 2000) {
      setErrors({ description: "Opis może mieć maks. 2000 znaków" });
      return;
    }
    goTo(5);
  }

  function handleConsentToggle(key: "acceptTerms" | "acceptPrivacy" | "acceptDpa", next: boolean) {
    if (key === "acceptTerms") setAcceptTerms(next);
    else if (key === "acceptPrivacy") setAcceptPrivacy(next);
    else setAcceptDpa(next);
    clearErrors();
  }

  function handleAcceptAll() {
    setAcceptTerms(true);
    setAcceptPrivacy(true);
    setAcceptDpa(true);
    clearErrors();
  }

  function handleSubmit() {
    if (!(acceptTerms && acceptPrivacy && acceptDpa)) {
      setErrors({ consents: "Aby kontynuować, zaakceptuj wszystkie zgody" });
      return;
    }
    clearErrors();

    startTransition(async () => {
      const fd = new FormData();
      fd.set("displayName", displayName.trim());
      fd.set("subdomain", subdomain.trim());
      fd.set("contactEmail", contactEmail.trim());
      fd.set("description", description.trim());
      fd.set("acceptTerms", acceptTerms ? "true" : "false");
      fd.set("acceptPrivacy", acceptPrivacy ? "true" : "false");
      fd.set("acceptDpa", acceptDpa ? "true" : "false");

      const result = await createOrganizerAction(fd);

      // On success, the action calls redirect() and this code is unreachable.
      if (!result) return;

      if ("errors" in result && result.errors) {
        const next: FieldErrors = {};
        if (result.errors.displayName) next.displayName = result.errors.displayName;
        if (result.errors.subdomain) next.subdomain = result.errors.subdomain;
        if (result.errors.contactEmail) next.contactEmail = result.errors.contactEmail;
        if (result.errors.description) next.description = result.errors.description;
        if (result.errors.acceptTerms || result.errors.acceptPrivacy || result.errors.acceptDpa) {
          next.consents =
            result.errors.acceptTerms ?? result.errors.acceptPrivacy ?? result.errors.acceptDpa;
        }
        setErrors(next);
        if (typeof result.jumpToStep === "number") setStep(result.jumpToStep as StepIndex);
        return;
      }

      if ("error" in result && result.error) {
        // Server returned a single top-level error with a step to jump to (e.g. subdomain taken).
        // Route the message to the field error of the target step so the relevant step renders it.
        const targetStep = typeof result.jumpToStep === "number" ? result.jumpToStep : 5;
        const field = STEP_TO_FIELD[targetStep] ?? "consents";
        setErrors({ [field]: result.error } as FieldErrors);
        setStep(targetStep as StepIndex);
        return;
      }
    });
  }

  // ----- Render the current step -----
  return (
    <WizardShell
      currentStep={step === 0 ? null : step}
      totalSteps={TOTAL_INPUT_STEPS}
    >
      {step === 0 && <StepWelcome firstName={firstName} onStart={() => goTo(1)} />}
      {step === 1 && (
        <StepName
          value={displayName}
          onChange={setDisplayName}
          error={errors.displayName ?? null}
          onBack={back}
          onNext={handleNameNext}
        />
      )}
      {step === 2 && (
        <StepSubdomain
          value={subdomain}
          onChange={handleSubdomainChange}
          error={errors.subdomain ?? null}
          onBack={back}
          onNext={handleSubdomainNext}
        />
      )}
      {step === 3 && (
        <StepEmail
          value={contactEmail}
          onChange={setContactEmail}
          error={errors.contactEmail ?? null}
          onBack={back}
          onNext={handleEmailNext}
        />
      )}
      {step === 4 && (
        <StepDescription
          value={description}
          onChange={setDescription}
          error={errors.description ?? null}
          onBack={back}
          onNext={handleDescriptionNext}
        />
      )}
      {step === 5 && (
        <StepConsents
          acceptTerms={acceptTerms}
          acceptPrivacy={acceptPrivacy}
          acceptDpa={acceptDpa}
          onChange={handleConsentToggle}
          onAcceptAll={handleAcceptAll}
          error={errors.consents ?? null}
          pending={pending}
          onBack={back}
          onSubmit={handleSubmit}
        />
      )}
    </WizardShell>
  );
}

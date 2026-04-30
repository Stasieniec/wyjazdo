"use client";

import { WizardShell } from "./WizardShell";

type Props = { firstName: string | null; defaultContactEmail: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function OnboardingWizard(_: Props) {
  return (
    <WizardShell currentStep={2} totalSteps={5}>
      <h1 className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] md:text-4xl">
        Test heading
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">Test hint</p>
    </WizardShell>
  );
}

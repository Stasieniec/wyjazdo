"use client";

type Props = {
  firstName: string | null;
  defaultContactEmail: string;
};

export function OnboardingWizard({ firstName, defaultContactEmail }: Props) {
  return (
    <div className="p-8">
      <p>Wizard placeholder — firstName: {firstName ?? "(none)"}, email: {defaultContactEmail}</p>
    </div>
  );
}

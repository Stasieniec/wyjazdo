"use client";

import type { ConsentConfigItem } from "@/lib/validators/consent";
import { Checkbox } from "@/components/ui";

type Props = {
  eventConsents: ConsentConfigItem[];
  errors?: Record<string, string>;
};

export function ConsentCheckboxes({ eventConsents, errors }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Zgody i oświadczenia</p>

      {/* Platform-required consents */}
      <Checkbox
        name="consent_regulamin"
        value="true"
        label={
          <>
            Akceptuję{" "}
            <a
              href="/regulamin"
              target="_blank"
              className="underline underline-offset-4 hover:text-primary"
            >
              Regulamin serwisu wyjazdo.pl
            </a>{" "}
            *
          </>
        }
        error={errors?.consent_regulamin}
      />
      <Checkbox
        name="consent_privacy"
        value="true"
        label={
          <>
            Zapoznałem/am się z{" "}
            <a
              href="/polityka-prywatnosci"
              target="_blank"
              className="underline underline-offset-4 hover:text-primary"
            >
              Polityką Prywatności
            </a>{" "}
            *
          </>
        }
        error={errors?.consent_privacy}
      />

      {/* Event-specific consents from organizer */}
      {eventConsents.map((consent) => (
        <div key={consent.id}>
          <Checkbox
            name={`consent_${consent.id}`}
            value="true"
            label={
              <>
                {consent.label}
                {consent.required ? " *" : ""}
              </>
            }
            error={errors?.[`consent_${consent.id}`]}
          />
          {consent.description && (
            <p className="ml-7 mt-1 text-xs text-muted-foreground">
              {consent.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

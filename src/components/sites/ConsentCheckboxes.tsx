"use client";

import type { ConsentConfigItem } from "@/lib/validators/consent";
import { Checkbox } from "@/components/ui";

type Props = {
  eventConsents: ConsentConfigItem[];
  errors?: Record<string, string>;
  values: Record<string, boolean>;
  onChange: (name: string, checked: boolean) => void;
};

export function ConsentCheckboxes({ eventConsents, errors, values, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Zgody i oświadczenia</p>

      {/* Platform-required consents */}
      <Checkbox
        name="consent_regulamin"
        value="true"
        checked={!!values.consent_regulamin}
        onChange={(e) => onChange("consent_regulamin", e.target.checked)}
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
        checked={!!values.consent_privacy}
        onChange={(e) => onChange("consent_privacy", e.target.checked)}
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
      {eventConsents.map((consent) => {
        const fieldName = `consent_${consent.id}`;
        return (
          <div key={consent.id}>
            <Checkbox
              name={fieldName}
              value="true"
              checked={!!values[fieldName]}
              onChange={(e) => onChange(fieldName, e.target.checked)}
              label={
                <>
                  {consent.label}
                  {consent.required ? " *" : ""}
                </>
              }
              error={errors?.[fieldName]}
            />
            {consent.description && (
              <p className="ml-7 mt-1 text-xs text-muted-foreground">
                {consent.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

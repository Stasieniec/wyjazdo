"use client";

import { useActionState } from "react";
import {
  BrandColorPicker,
  Card,
  ImageUpload,
  Input,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import { updateSettingsAction, type SettingsFormState } from "./actions";

type Social = Record<string, string | null>;

type Props = {
  defaults: {
    displayName: string;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    brandColor: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    social: Social;
  };
};

export function SettingsForm({ defaults }: Props) {
  const [state, formAction] = useActionState<SettingsFormState, FormData>(
    updateSettingsAction,
    null,
  );

  const social = defaults.social;

  return (
    <form action={formAction} className="mt-8 max-w-2xl space-y-6">
      <Section
        title="Profil"
        description="Podstawowe informacje widoczne na Twojej stronie organizatora."
      >
        <Input
          name="displayName"
          label="Wyświetlana nazwa"
          defaultValue={defaults.displayName}
          required
          maxLength={100}
          error={state?.errors?.displayName}
        />
        <Textarea
          name="description"
          label="Opis"
          defaultValue={defaults.description ?? ""}
          rows={4}
          maxLength={2000}
          error={state?.errors?.description}
        />
      </Section>

      <Section
        title="Wygląd"
        description="Logo, zdjęcie okładki i kolor przewodni Twojej strony."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <ImageUpload
            name="logoUrl"
            label="Logo"
            defaultValue={defaults.logoUrl}
            aspect="logo"
            error={state?.errors?.logoUrl}
          />
          <div className="sm:col-span-1">
            <ImageUpload
              name="coverUrl"
              label="Zdjęcie okładki"
              defaultValue={defaults.coverUrl}
              aspect="cover"
              error={state?.errors?.coverUrl}
            />
          </div>
        </div>
        <BrandColorPicker
          name="brandColor"
          label="Kolor marki"
          defaultValue={defaults.brandColor}
          error={state?.errors?.brandColor}
        />
      </Section>

      <Section
        title="Kontakt"
        description="Pokazane na profilu organizatora i używane do powiadomień o nowych zapisach."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            type="email"
            name="contactEmail"
            label="Email kontaktowy"
            required
            defaultValue={defaults.contactEmail ?? ""}
            error={state?.errors?.contactEmail}
          />
          <Input
            name="contactPhone"
            label="Telefon"
            defaultValue={defaults.contactPhone ?? ""}
            error={state?.errors?.contactPhone}
          />
        </div>
      </Section>

      <Section title="Social" description="Linki do Twoich profili społecznościowych.">
        <Input
          type="url"
          name="website"
          label="Strona WWW"
          defaultValue={social.website ?? ""}
          placeholder="https://..."
          error={state?.errors?.website}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            name="instagram"
            label="Instagram"
            defaultValue={social.instagram ?? ""}
            placeholder="@nazwa"
            error={state?.errors?.instagram}
          />
          <Input
            name="facebook"
            label="Facebook"
            defaultValue={social.facebook ?? ""}
            placeholder="nazwa lub https://facebook.com/..."
            error={state?.errors?.facebook}
          />
        </div>
      </Section>

      <div className="flex items-center gap-4">
        <SubmitButton>Zapisz zmiany</SubmitButton>
        {state && !state.errors && (
          <p className="text-sm text-success">Zmiany zostały zapisane.</p>
        )}
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

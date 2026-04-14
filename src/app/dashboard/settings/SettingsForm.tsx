"use client";

import { useActionState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
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
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateSettingsAction,
    null,
  );

  const social = defaults.social;

  return (
    <form action={formAction} className="mt-8 max-w-xl space-y-4">
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
      <Input
        type="url"
        name="logoUrl"
        label="URL logo"
        defaultValue={defaults.logoUrl ?? ""}
        error={state?.errors?.logoUrl}
      />
      <Input
        type="url"
        name="coverUrl"
        label="URL okładki"
        defaultValue={defaults.coverUrl ?? ""}
        error={state?.errors?.coverUrl}
      />
      <Input
        name="brandColor"
        label="Kolor marki (hex, np. #1e40af)"
        defaultValue={defaults.brandColor ?? ""}
        pattern="#[0-9a-fA-F]{6}"
        error={state?.errors?.brandColor}
      />
      <Input
        type="email"
        name="contactEmail"
        label="Email kontaktowy"
        defaultValue={defaults.contactEmail ?? ""}
        error={state?.errors?.contactEmail}
      />
      <Input
        name="contactPhone"
        label="Telefon"
        defaultValue={defaults.contactPhone ?? ""}
        error={state?.errors?.contactPhone}
      />
      <Input
        type="url"
        name="website"
        label="Strona WWW"
        defaultValue={social.website ?? ""}
        error={state?.errors?.website}
      />
      <Input
        name="instagram"
        label="Instagram"
        defaultValue={social.instagram ?? ""}
        error={state?.errors?.instagram}
      />
      <Input
        name="facebook"
        label="Facebook"
        defaultValue={social.facebook ?? ""}
        error={state?.errors?.facebook}
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Zapisywanie..." : "Zapisz"}
      </Button>
    </form>
  );
}

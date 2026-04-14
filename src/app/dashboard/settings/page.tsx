import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { updateSettingsAction } from "./actions";
import { Button, Input, Textarea } from "@/components/ui";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  const social = organizer.socialLinks
    ? (JSON.parse(organizer.socialLinks) as Record<string, string | null>)
    : {};

  return (
    <div>
      <h1 className="text-2xl font-semibold">Ustawienia</h1>
      <form action={async (formData: FormData) => { "use server"; await updateSettingsAction(formData); }} className="mt-8 max-w-xl space-y-4">
        <Input
          name="displayName"
          label="Wyświetlana nazwa"
          defaultValue={organizer.displayName}
          required
          maxLength={100}
        />
        <Textarea
          name="description"
          label="Opis"
          defaultValue={organizer.description ?? ""}
          rows={4}
          maxLength={2000}
        />
        <Input type="url" name="logoUrl" label="URL logo" defaultValue={organizer.logoUrl ?? ""} />
        <Input type="url" name="coverUrl" label="URL okładki" defaultValue={organizer.coverUrl ?? ""} />
        <Input
          name="brandColor"
          label="Kolor marki (hex, np. #1e40af)"
          defaultValue={organizer.brandColor ?? ""}
          pattern="#[0-9a-fA-F]{6}"
        />
        <Input type="email" name="contactEmail" label="Email kontaktowy" defaultValue={organizer.contactEmail ?? ""} />
        <Input name="contactPhone" label="Telefon" defaultValue={organizer.contactPhone ?? ""} />
        <Input type="url" name="website" label="Strona WWW" defaultValue={social.website ?? ""} />
        <Input name="instagram" label="Instagram" defaultValue={social.instagram ?? ""} />
        <Input name="facebook" label="Facebook" defaultValue={social.facebook ?? ""} />

        <Button type="submit">Zapisz</Button>
      </form>
    </div>
  );
}

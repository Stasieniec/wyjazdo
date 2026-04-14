import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { updateSettingsAction } from "./actions";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer) redirect("/dashboard/onboarding");

  const social = organizer.socialLinks
    ? (JSON.parse(organizer.socialLinks) as Record<string, string | null>)
    : {};

  const field = (name: string, label: string, value: string | null, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        defaultValue={value ?? ""}
        className="mt-1 w-full rounded-md border px-3 py-2"
        {...props}
      />
    </label>
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Ustawienia</h1>
      <form action={async (formData: FormData) => { "use server"; await updateSettingsAction(formData); }} className="mt-8 max-w-xl space-y-4">
        {field("displayName", "Wyświetlana nazwa", organizer.displayName, { required: true, maxLength: 100 })}
        <label className="block">
          <span className="text-sm font-medium">Opis</span>
          <textarea
            name="description"
            defaultValue={organizer.description ?? ""}
            rows={4}
            maxLength={2000}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        {field("logoUrl", "URL logo", organizer.logoUrl, { type: "url" })}
        {field("coverUrl", "URL okładki", organizer.coverUrl, { type: "url" })}
        {field("brandColor", "Kolor marki (hex, np. #1e40af)", organizer.brandColor, { pattern: "#[0-9a-fA-F]{6}" })}
        {field("contactEmail", "Email kontaktowy", organizer.contactEmail, { type: "email" })}
        {field("contactPhone", "Telefon", organizer.contactPhone)}
        {field("website", "Strona WWW", social.website ?? "", { type: "url" })}
        {field("instagram", "Instagram", social.instagram ?? "")}
        {field("facebook", "Facebook", social.facebook ?? "")}

        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Zapisz
        </button>
      </form>
    </div>
  );
}

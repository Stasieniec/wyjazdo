import { currentUser } from "@clerk/nextjs/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await currentUser();
  const defaultContactEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Witaj w Wyjazdo</h1>
      <p className="mt-2 text-muted-foreground">Stwórz swój profil organizatora, aby zacząć.</p>
      <OnboardingForm defaultContactEmail={defaultContactEmail} />
    </div>
  );
}

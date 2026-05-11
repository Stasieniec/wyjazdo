import { redirect } from "next/navigation";
import { loginAction } from "./actions";

export const metadata = { title: "Wyjazdo Admin" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const sp = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const result = await loginAction(formData);
    if (result?.error) {
      const params = new URLSearchParams({ e: result.error });
      redirect(`/admin/login?${params.toString()}`);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <form
        action={action}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-primary">Wyjazdo Admin</h1>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Hasło</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        {sp.e ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {sp.e}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 font-medium text-white hover:opacity-90"
        >
          Zaloguj
        </button>
      </form>
    </div>
  );
}

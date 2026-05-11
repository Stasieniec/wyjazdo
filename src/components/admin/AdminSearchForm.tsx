export function AdminSearchForm({
  action,
  defaultValue = "",
  placeholder = "Szukaj…",
}: {
  action: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <form action={action} method="get" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
      <button
        type="submit"
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Szukaj
      </button>
    </form>
  );
}

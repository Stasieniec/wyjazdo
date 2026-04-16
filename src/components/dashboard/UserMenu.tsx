"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";

export function UserMenu({ dropUp }: { dropUp?: boolean } = {}) {
  const { user, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isLoaded || !user) {
    // Reserve space so layout doesn't jump while loading
    return <div className="h-8 w-8 rounded-full bg-muted" aria-hidden />;
  }

  const initial =
    user.firstName?.charAt(0)?.toUpperCase() ??
    user.primaryEmailAddress?.emailAddress?.charAt(0)?.toUpperCase() ??
    "?";

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const name = user.firstName ?? user.fullName ?? email;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu użytkownika"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-2 ring-transparent transition-[box-shadow] hover:ring-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {user.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 w-56 overflow-hidden rounded-lg border border-border bg-background shadow-lg ${
            dropUp
              ? "bottom-full left-0 mb-2"
              : "right-0 top-full mt-2"
          }`}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            {email && email !== name && (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            )}
          </div>
          <nav className="py-1 text-sm">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-foreground transition-colors hover:bg-muted"
              role="menuitem"
            >
              Ustawienia organizatora
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openUserProfile();
              }}
              className="block w-full px-3 py-2 text-left text-foreground transition-colors hover:bg-muted"
              role="menuitem"
            >
              Dane konta
            </button>
          </nav>
          <div className="border-t border-border py-1">
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/" })}
              className="block w-full px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              role="menuitem"
            >
              Wyloguj się
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

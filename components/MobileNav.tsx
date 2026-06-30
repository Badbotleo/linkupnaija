"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationsBell from "./NotificationsBell";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/events", label: "Explore", emoji: "🔎" },
  { href: "/venues", label: "Venues", emoji: "📍" },
  { href: "/tournament", label: "Tournament", emoji: "🎮" },
  { href: "/host", label: "Host", emoji: "🎤" },
  { href: "/opportunities", label: "Opportunities", emoji: "✨" },
];

export default function MobileNav({
  userId,
  isAdmin,
  unreadMessages,
}: {
  userId: string | null;
  isAdmin: boolean;
  unreadMessages: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Portal target is only available on the client.
  useEffect(() => setMounted(true), []);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-10 w-10 place-items-center rounded-lg text-gray-700 transition hover:bg-gray-50"
      >
        <MenuIcon />
      </button>

      {/* Overlay + drawer are portalled to <body> so they escape the header's
          backdrop-blur, which would otherwise trap fixed positioning. */}
      {mounted &&
        createPortal(
          <>
            {/* Overlay */}
            <div
              onClick={() => setOpen(false)}
              aria-hidden
              className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 lg:hidden ${
                open ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />

            {/* Drawer */}
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className={`fixed right-0 top-0 z-[70] flex h-full w-[82%] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
                open ? "translate-x-0" : "translate-x-full"
              }`}
            >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <span className="text-lg font-extrabold tracking-tight text-gray-900">
            Menu
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-gray-700 transition hover:bg-brand-50 hover:text-brand"
            >
              <span aria-hidden>{l.emoji}</span>
              {l.label}
            </Link>
          ))}

          <div className="my-3 border-t border-gray-100" />

          {/* Dark mode + Notifications */}
          <div className="flex items-center justify-between rounded-xl px-4 py-2">
            <span className="text-base font-semibold text-gray-700">
              Dark mode
            </span>
            <ThemeToggle />
          </div>
          {userId && (
            <div className="flex items-center justify-between rounded-xl px-4 py-2">
              <span className="text-base font-semibold text-gray-700">
                Notifications
              </span>
              <NotificationsBell userId={userId} />
            </div>
          )}

          <div className="my-3 border-t border-gray-100" />

          {userId ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-brand transition hover:bg-brand-50"
                >
                  <span aria-hidden>🛠️</span>
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-gray-700 transition hover:bg-brand-50 hover:text-brand"
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden>📋</span>
                  Dashboard
                </span>
                {unreadMessages > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>
              <form action="/auth/signout" method="post" className="px-4 pt-3">
                <button type="submit" className="btn-outline w-full py-2.5">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-2 px-4 pt-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="btn-outline w-full py-2.5"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="btn-primary w-full py-2.5"
              >
                Sign up
              </Link>
            </div>
          )}
            </nav>
          </aside>
          </>,
          document.body
        )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "./Avatar";
import ThemeToggle from "./ThemeToggle";

const MENU = [
  { href: "/live", label: "Live feed", icon: "activity" },
  { href: "/dashboard", label: "My Events", icon: "calendar" },
  { href: "/host", label: "Hosting", icon: "mic" },
  { href: "/friends", label: "Friends", icon: "users" },
  { href: "/dashboard", label: "Saved", icon: "bookmark" },
  { href: "/profile/edit", label: "Settings", icon: "settings" },
  { href: "mailto:support@linkupnaija.com", label: "Help", icon: "help" },
];

const ALSO = [
  { label: "AI Assistant", icon: "sparkles", action: "chat" },
  { href: "/venues", label: "Venues", icon: "pin" },
  { href: "/opportunities", label: "Opportunities", icon: "briefcase" },
  { href: "/tournament", label: "FC26 Tournament", icon: "gamepad" },
];

export default function MobileNav({
  userId,
  isAdmin,
  name,
  avatarUrl,
}: {
  userId: string | null;
  isAdmin: boolean;
  name: string | null;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
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

  // A friendly @username derived from the display name (no real handle field).
  const handle = (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

  function openChat() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("linkup:open-chat"));
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-gray-200"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {mounted &&
        createPortal(
          <>
            <div
              onClick={() => setOpen(false)}
              aria-hidden
              className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 lg:hidden ${
                open ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className={`fixed left-0 top-0 z-[70] flex h-full w-[86%] max-w-sm flex-col bg-gray-50 shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
                open ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <span className="text-xl font-extrabold tracking-tight text-gray-900">
                  Menu
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="grid h-9 w-9 place-items-center rounded-full bg-gray-200 text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-6">
                {/* Profile summary */}
                {userId ? (
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
                  >
                    <Avatar name={name} url={avatarUrl} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-gray-900">
                        {name ?? "Your profile"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {handle ? `@${handle}` : "View your profile"}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex gap-2 rounded-2xl bg-white p-3 shadow-sm">
                    <Link href="/login" className="btn-outline flex-1 py-2 text-center">
                      Log in
                    </Link>
                    <Link href="/signup" className="btn-primary flex-1 py-2 text-center">
                      Sign up
                    </Link>
                  </div>
                )}

                {/* Appearance */}
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
                  <span className="flex items-center gap-3 text-[15px] font-semibold text-gray-800">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand">
                      <Icon name="moon" />
                    </span>
                    Dark mode
                  </span>
                  <ThemeToggle />
                </div>

                {/* Menu list */}
                <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
                  {MENU.map((m) => (
                    <MenuRow key={m.label} href={m.href} label={m.label} icon={m.icon} />
                  ))}
                  {isAdmin && (
                    <MenuRow href="/admin" label="Admin" icon="shield" />
                  )}
                  {userId && (
                    <form action="/auth/signout" method="post">
                      <button
                        type="submit"
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-red-50 text-red-500">
                          <Icon name="logout" />
                        </span>
                        Log out
                      </button>
                    </form>
                  )}
                </div>

                {/* Also from LinkUpNaija */}
                <p className="mb-2 mt-6 px-1 text-sm font-bold text-gray-500">
                  Also from LinkUpNaija
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ALSO.map((a) =>
                    a.action === "chat" ? (
                      <button
                        key={a.label}
                        type="button"
                        onClick={openChat}
                        className="flex items-center gap-2 rounded-2xl bg-white p-3 text-left shadow-sm"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand">
                          <Icon name={a.icon} />
                        </span>
                        <span className="text-sm font-semibold text-gray-800">
                          {a.label}
                        </span>
                      </button>
                    ) : (
                      <Link
                        key={a.label}
                        href={a.href!}
                        className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand">
                          <Icon name={a.icon} />
                        </span>
                        <span className="text-sm font-semibold text-gray-800">
                          {a.label}
                        </span>
                      </Link>
                    )
                  )}
                </div>
              </div>
            </aside>
          </>,
          document.body
        )}
    </div>
  );
}

function MenuRow({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-gray-50 px-4 py-3.5 text-[15px] font-semibold text-gray-800 transition last:border-0 hover:bg-gray-50"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand">
        <Icon name={icon} />
      </span>
      {label}
    </Link>
  );
}

function Icon({ name }: { name: string }) {
  const p: Record<string, string> = {
    activity: "M22 12h-4l-3 9L9 3l-3 9H2",
    moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
    calendar: "M3 8h18M7 3v3m10-3v3M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    mic: "M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11",
    bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    help: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    sparkles: "M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z",
    pin: "M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    briefcase: "M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",
    gamepad: "M6 12h4m-2-2v4M15 11h.01M18 13h.01M17.32 5H6.68a4 4 0 0 0-3.97 3.5l-.8 6A3 3 0 0 0 4.88 18c1 0 1.5-.5 2-1l1.3-1.3a2 2 0 0 1 1.4-.6h4.84a2 2 0 0 1 1.4.6l1.3 1.3c.5.5 1 1 2 1a3 3 0 0 0 2.97-3.5l-.8-6A4 4 0 0 0 17.32 5z",
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={p[name] ?? p.help} />
    </svg>
  );
}

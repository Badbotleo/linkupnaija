"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProBadge from "./ProBadge";
import Avatar from "./Avatar";

// Top actions as a compact tappable grid.
const QUICK = [
  { href: "/events", label: "Explore", icon: "search" },
  { href: "/host", label: "Host", icon: "mic" },
  { href: "/circles", label: "Circles", icon: "circles" },
  { href: "/friends", label: "Friends", icon: "users" },
];

// Grouped, scannable lists.
// The bottom bar already carries Home, Explore, Host, Alerts and Profile, so
// this drawer only needs the places it can't reach. Everything here used to be
// one flat list of fourteen rows, which is a directory, not a menu.
const DISCOVER = [
  { href: "/things-to-do", label: "Things to do", icon: "sparkles" },
  { href: "/venues", label: "Venues", icon: "pin" },
  { href: "/circles", label: "Circles", icon: "circles" },
  { href: "/rides", label: "Rides", icon: "car" },
];

const YOU = [
  { href: "/dashboard", label: "My link-ups", icon: "calendar" },
  { href: "/refer", label: "Invite & earn ₦500", icon: "gift" },
  { href: "/profile/edit", label: "Settings", icon: "settings" },
];

// The long tail, one tap away rather than always on screen.
const MORE = [
  { href: "/live", label: "Live feed", icon: "activity" },
  { href: "/hosts/leaderboard", label: "Host leaderboard", icon: "trophy" },
  { href: "/drivers/leaderboard", label: "Top drivers", icon: "star" },
  { href: "/drive", label: "Drive with us", icon: "car" },
  { href: "/opportunities", label: "Opportunities", icon: "briefcase" },
  { href: "/tournament", label: "FC26 Tournament", icon: "gamepad" },
  { href: "mailto:support@linkupnaija.com", label: "Help", icon: "help" },
];

export default function MobileNav({
  userId,
  isAdmin,
  name,
  avatarUrl,
  isPro = false,
}: {
  userId: string | null;
  isAdmin: boolean;
  name: string | null;
  avatarUrl: string | null;
  isPro?: boolean;
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
    <div>
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
              className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${
                open ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className={`fixed left-0 top-0 z-[70] flex h-full w-[86%] max-w-sm flex-col bg-gray-50 shadow-2xl transition-transform duration-300 ease-out ${
                open ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
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
                      <p className="flex items-center gap-1 truncate text-base font-bold text-gray-900">
                        <span className="truncate">{name ?? "Your profile"}</span>
                        {isPro && <ProBadge size={16} />}
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

                {/* Quick actions */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {QUICK.map((q) => (
                    <Link
                      key={q.label}
                      href={q.href}
                      className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3 shadow-sm transition hover:bg-brand-50"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand">
                        <Icon name={q.icon} />
                      </span>
                      <span className="text-xs font-bold text-gray-800">{q.label}</span>
                    </Link>
                  ))}
                </div>

                {/* Discover */}
                <Section title="Discover">
                  <button
                    type="button"
                    onClick={openChat}
                    className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3.5 text-left text-[15px] font-semibold text-gray-800 transition hover:bg-gray-50"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand">
                      <Icon name="sparkles" />
                    </span>
                    AI Assistant
                  </button>
                  {DISCOVER.map((m) => (
                    <MenuRow key={m.label} href={m.href} label={m.label} icon={m.icon} />
                  ))}
                </Section>

                {/* You */}
                <Section title="You">
                  {YOU.map((m) => (
                    <MenuRow key={m.label} href={m.href} label={m.label} icon={m.icon} />
                  ))}
                  {isAdmin && <MenuRow href="/admin" label="Admin" icon="shield" />}
                </Section>

                {/* Everything else, folded away. A native <details> keeps this
                    keyboard- and screen-reader-friendly with no extra state. */}
                <details className="mt-4 group">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl bg-white p-3 text-[15px] font-semibold text-gray-800 shadow-sm">
                    <span className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand">
                        <Icon name="more" />
                      </span>
                      More
                    </span>
                    <span className="text-gray-400 transition group-open:rotate-180">
                      <Icon name="chevronDown" />
                    </span>
                  </summary>
                  <div className="mt-1">
                    {MORE.map((m) => (
                      <MenuRow key={m.label} href={m.href} label={m.label} icon={m.icon} />
                    ))}
                  </div>
                </details>

                {/* Dark mode toggle removed 5 Aug. Only 6 of 194 components
                    carried dark: variants — the rail, bottom bar, header,
                    footer, logo and install banner — so switching it on gave
                    you dark chrome wrapped around a blinding white page.
                    A toggle that half-works is worse than none.

                    Everything needed to bring it back is still here:
                    darkMode: "class" in tailwind.config.ts, the pre-paint
                    script in layout.tsx, ThemeToggle, and those 6 files.
                    Restore this block once the other 188 are covered. */}

                {userId && (
                  <form action="/auth/signout" method="post" className="mt-3">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left text-[15px] font-semibold text-red-600 shadow-sm transition hover:bg-red-50"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-red-50 text-red-500">
                        <Icon name="logout" />
                      </span>
                      Log out
                    </button>
                  </form>
                )}
              </div>
            </aside>
          </>,
          document.body
        )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-400">
        {title}
      </p>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">{children}</div>
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
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
    circles: "M9 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM15 21a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
    trophy: "M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3",
    calendar: "M3 8h18M7 3v3m10-3v3M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    mic: "M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11",
    bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    help: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    gift: "M20 12v10H4V12M2 7h20v5H2V7zM12 22V7M12 7s-2-5-5-5-2.5 5 0 5h5zM12 7s2-5 5-5 2.5 5 0 5h-5z",
    sparkles: "M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z",
    pin: "M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    car: "M5 17H3v-4l2-5h14l2 5v4h-2M5 17a2 2 0 1 0 4 0M5 17h10m4 0a2 2 0 1 1-4 0M7 8h10",
    briefcase: "M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",
    gamepad: "M6 12h4m-2-2v4M15 11h.01M18 13h.01M17.32 5H6.68a4 4 0 0 0-3.97 3.5l-.8 6A3 3 0 0 0 4.88 18c1 0 1.5-.5 2-1l1.3-1.3a2 2 0 0 1 1.4-.6h4.84a2 2 0 0 1 1.4.6l1.3 1.3c.5.5 1 1 2 1a3 3 0 0 0 2.97-3.5l-.8-6A4 4 0 0 0 17.32 5z",
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={p[name] ?? p.help} />
    </svg>
  );
}

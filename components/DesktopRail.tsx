"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LineIcon from "./ui/LineIcon";
import { LogoMark } from "./Logo";

/**
 * Persistent side navigation on laptops and desktops.
 *
 * On a phone the bottom bar makes this feel like an app. On a wide screen
 * there was nothing equivalent — just a top bar and a marketing footer, which
 * is what made the site read as a website the moment it left mobile. Every
 * app people actually use on a desktop (Spotify, Slack, X, Discord) anchors
 * navigation to a left rail, and this is that.
 *
 * Hidden below `lg`, where BottomNav already does the job.
 */
const MAIN = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/events", label: "Explore", icon: "search" },
  { href: "/circles", label: "Circles", icon: "circles" },
  { href: "/venues", label: "Venues", icon: "pin" },
  { href: "/things-to-do", label: "Things to do", icon: "sparkles" },
  { href: "/rides", label: "Rides", icon: "car" },
  { href: "/drive", label: "Drive with us", icon: "car" },
];

const YOU = [
  { href: "/dashboard", label: "My link-ups", icon: "calendar" },
  { href: "/tickets", label: "Tickets", icon: "ticket" },
  { href: "/friends", label: "Friends", icon: "users" },
  { href: "/notifications", label: "Alerts", icon: "bell" },
  { href: "/refer", label: "Invite & earn", icon: "gift" },
];

export default function DesktopRail({
  isLoggedIn,
  unread = 0,
  isAdmin = false,
}: {
  isLoggedIn: boolean;
  unread?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[248px] flex-col border-r border-gray-100 bg-white/80 px-3 py-4 backdrop-blur lg:flex dark:border-white/10 dark:bg-[#1A1040]/80">
      <Link href="/" className="mb-5 flex items-center gap-2.5 px-3">
        <LogoMark size={32} />
        <span className="text-[19px] font-extrabold tracking-tight">
          <span className="text-[#1A1040] dark:text-white">Link</span>
          <span className="text-brand dark:text-[#7F77DD]">Up</span>
          <span className="text-[#1A1040] dark:text-white">Naija</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto">
        <RailGroup items={MAIN} active={active} />

        {isLoggedIn && (
          <>
            <p className="mb-1 mt-5 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">
              You
            </p>
            <RailGroup items={YOU} active={active} unread={unread} />

            <p className="mb-1 mt-5 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">
              Account
            </p>
            <RailGroup
              items={[
                { href: "/profile", label: "Profile", icon: "users" },
                { href: "/profile/edit", label: "Settings", icon: "settings" },
                ...(isAdmin
                  ? [{ href: "/admin", label: "Admin", icon: "shield" }]
                  : []),
              ]}
              active={active}
            />

            <form action="/auth/signout" method="post" className="mt-1">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-bold text-red-600 transition hover:bg-red-50"
              >
                <LineIcon name="logout" size={20} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">Log out</span>
              </button>
            </form>
          </>
        )}
      </nav>

      {/* Primary action sits at the bottom, always reachable. */}
      <div className="mt-3 shrink-0 px-1">
        {isLoggedIn ? (
          <Link
            href="/host"
            className="flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            <LineIcon name="mic" size={16} />
            Host a link-up
          </Link>
        ) : (
          <div className="space-y-2">
            <Link
              href="/signup"
              className="flex items-center justify-center rounded-full bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center rounded-full border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-brand/40 hover:text-brand"
            >
              Log in
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

function RailGroup({
  items,
  active,
  unread = 0,
}: {
  items: { href: string; label: string; icon: string }[];
  active: (href: string) => boolean;
  unread?: number;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((i) => {
        const on = active(i.href);
        return (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-bold transition ${
                on
                  ? "bg-brand-50 text-brand dark:bg-white/10 dark:text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-white/5"
              }`}
            >
              <LineIcon name={i.icon} size={20} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{i.label}</span>
              {i.href === "/notifications" && unread > 0 && (
                <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-black text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

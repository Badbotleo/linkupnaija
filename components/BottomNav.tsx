"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BRAND = "#534AB7";

export default function BottomNav({
  isLoggedIn,
  unread = 0,
}: {
  isLoggedIn: boolean;
  unread?: number;
}) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const notifHref = isLoggedIn ? "/notifications" : "/login?redirect=/notifications";
  const profileHref = isLoggedIn ? "/profile" : "/login?redirect=/profile";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-white/10 dark:bg-[#1A1040]/95"
      aria-label="Primary"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-2">
        <Tab href="/" label="Home" active={active("/")} icon={<HomeIcon />} />
        <Tab
          href="/events"
          label="Explore"
          active={active("/events")}
          icon={<ExploreIcon />}
        />

        {/* Host — raised primary action */}
        <Link
          href="/host"
          aria-label="Host an event"
          className="flex flex-1 flex-col items-center justify-center"
        >
          <span
            className="grid h-11 w-11 -translate-y-1 place-items-center rounded-full text-white shadow-lg shadow-brand/30"
            style={{ backgroundColor: BRAND }}
          >
            <PlusIcon />
          </span>
        </Link>

        <Tab
          href={notifHref}
          label="Alerts"
          active={active("/notifications")}
          icon={<BellIcon />}
          dot={unread > 0}
        />
        <Tab
          href={profileHref}
          label="Profile"
          active={active("/profile") || active("/dashboard")}
          icon={<UserIcon />}
        />
      </div>
    </nav>
  );
}

function Tab({
  href,
  label,
  active,
  icon,
  dot,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
      style={active ? { color: BRAND } : undefined}
      aria-current={active ? "page" : undefined}
    >
      <span className={active ? "" : "text-gray-500 dark:text-gray-300"}>
        {icon}
      </span>
      <span
        className={`text-[11px] font-semibold ${
          active ? "" : "text-gray-500 dark:text-gray-300"
        }`}
      >
        {label}
      </span>
      {dot && (
        <span className="absolute right-[22%] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-[#1A1040]" />
      )}
    </Link>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}
function ExploreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

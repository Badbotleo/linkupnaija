"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BRAND = "#534AB7";

export default function BottomNav({
  isLoggedIn,
  unread = 0,
  unreadDms = 0,
}: {
  isLoggedIn: boolean;
  unread?: number;
  unreadDms?: number;
}) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  /**
   * The inbox opens on MESSAGES, not alerts.
   *
   * The first cut of this landed on /notifications and put a DM two taps
   * away, which is backwards: alerts are pushed to you and are mostly
   * "somebody joined your event", while a conversation is the thing people
   * come back for. Alerts are one tap away inside, which is the right way
   * round for a platform whose premise is people talking to each other.
   */
  const inboxHref = isLoggedIn ? "/messages" : "/login?redirect=/messages";
  const profileHref = isLoggedIn ? "/profile" : "/login?redirect=/profile";

  return (
    <nav
      // Measured by the events reel, which sizes a slide to end just above
      // this bar. A class name would have been a selector that breaks the
      // moment someone restyles the nav; this says what it is for.
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-white/10 dark:bg-[#121212]/95"
      aria-label="Primary"
    >
      <div className="mx-auto flex h-[52px] max-w-lg items-stretch justify-around px-2">
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
            className="grid h-9 w-9 place-items-center rounded-full text-white shadow-md shadow-brand/25 transition active:scale-90"
            style={{ backgroundColor: BRAND }}
          >
            <PlusIcon />
          </span>
        </Link>

        {/* One Inbox, holding Alerts and Messages.
            Messages used to be an icon in the top bar, which was the right
            answer until that bar started hiding on scroll and took the
            unread badge with it. Here it is in the thumb zone and always
            visible; InboxTabs switches between the two inside. */}
        <Tab
          href={inboxHref}
          label="Inbox"
          active={active("/notifications") || active("/messages")}
          icon={<InboxIcon />}
          dot={unread + unreadDms > 0}
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
      /* Icon only, the way X does it.
         Five icons each carrying a caption made the bar two rows tall, which
         is what pushed everything down the screen. These are the most
         conventional icons in mobile software — a house, a magnifier, a bell,
         a person — so the caption was telling people what they already knew,
         while being the only text on screen competing with the page's own.
         The name survives as aria-label, so screen readers lose nothing. */
      aria-label={label}
      className="relative flex flex-1 items-center justify-center"
      style={active ? { color: BRAND } : undefined}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full transition ${
          active ? "bg-brand/10" : "text-gray-500 dark:text-gray-300"
        }`}
      >
        {icon}
      </span>
      {/* With no label beneath it, the dot sits on the icon rather than
          beside it. */}
      {dot && (
        <span className="absolute right-[26%] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-[#121212]" />
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
function InboxIcon() {
  // A conversation, because the tab opens on Messages. It was a bell while
  // this slot was Alerts, and a bell over a screen of DMs is a small lie.
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 8.5-8.5A8.4 8.4 0 0 1 21 11.5z" />
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

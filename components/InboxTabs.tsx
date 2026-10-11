"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * One inbox, two tabs.
 *
 * Alerts and Messages were two separate destinations reached two different
 * ways: Alerts from the bottom bar, Messages from an icon in the top bar.
 * That top bar now hides on scroll, so the message icon and its unread
 * badge slid off screen the moment anybody started browsing — and a product
 * this young cannot rely on people remembering where their DMs live the way
 * they do on Instagram.
 *
 * So they are one place now. The bottom bar has a single Inbox tab carrying
 * the combined count, in the thumb zone rather than the top-right corner,
 * which is the hardest point to reach on a large phone. These tabs sit
 * inside it.
 *
 * TWO ROUTES, NOT ONE PAGE. Each keeps its own URL, its own server render
 * and its own loading state; the switcher is the only thing that makes them
 * feel like one destination. Merging them into a single feed would have
 * buried a real conversation under "somebody liked your event", which is the
 * one thing worth avoiding when combining the two.
 */
export default function InboxTabs({
  alerts = 0,
  messages = 0,
}: {
  alerts?: number;
  messages?: number;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: "/notifications", label: "Alerts", count: alerts },
    { href: "/messages", label: "Messages", count: messages },
  ];

  return (
    <div className="container-page max-w-[720px] pt-3">
      <div
        role="tablist"
        aria-label="Inbox"
        className="flex gap-2 rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
      >
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              role="tab"
              aria-selected={active}
              aria-label={
                t.count > 0 ? `${t.label}, ${t.count} unread` : t.label
              }
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                active
                  ? "bg-white text-brand shadow-card dark:bg-[#1b1b1b]"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                  {t.count > 9 ? "9+" : t.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

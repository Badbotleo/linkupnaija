"use client";

import { Children, isValidElement, useState } from "react";
import { useSearchParams } from "next/navigation";

export interface DashTab {
  id: string;
  label: string;
  count: number;
}

/**
 * The dashboard's event lists, one at a time.
 *
 * Hosting, past, attending, pending and declined were five headings stacked
 * down a page that already carried a profile card, a wallet, referrals,
 * circles, memories and payouts. Finding "what am I going to on Saturday"
 * meant scrolling through everything else first.
 *
 * Same underline rail as the explore tabs, so the two screens teach the same
 * gesture. Each child carries a `key` matching its tab's `id` — panes used
 * to be matched by POSITION, which meant reordering the tabs quietly
 * showed the wrong list under each one, with nothing to catch it.
 */
export default function DashboardTabs({
  tabs,
  children,
}: {
  tabs: DashTab[];
  children: React.ReactNode;
}) {
  const panes = Children.toArray(children);
  // ?tab= wins when it names a real tab, so "My tickets" on the profile can
  // land you on Going rather than on whatever happened to be non-empty.
  const wanted = useSearchParams().get("tab");
  const [active, setActive] = useState(() => {
    if (wanted && tabs.some((t) => t.id === wanted)) return wanted;
    // Otherwise open on the first tab with something in it — landing on an
    // empty "Hosting" when you have three events on Saturday is the wrong
    // first impression.
    return (tabs.find((t) => t.count > 0) ?? tabs[0])?.id ?? "";
  });
  // React prefixes keys from Children.toArray with ".$".
  const paneFor = (id: string) =>
    panes.find(
      (c) =>
        isValidElement(c) && String(c.key ?? "").replace(/^\.\$/, "") === id
    ) ?? null;

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex overflow-x-auto border-b border-gray-200 px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              aria-current={on}
              className={`relative shrink-0 whitespace-nowrap px-4 py-3 text-[15px] font-bold transition ${
                on ? "text-gray-900" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-black ${
                    on ? "bg-brand text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {t.count}
                </span>
              )}
              {on && (
                <span className="absolute inset-x-3 -bottom-px h-1 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5">{paneFor(active)}</div>
    </div>
  );
}

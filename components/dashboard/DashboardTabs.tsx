"use client";

import { Children, useState } from "react";

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
 * gesture. Children must be in the same order as `tabs`.
 */
export default function DashboardTabs({
  tabs,
  children,
}: {
  tabs: DashTab[];
  children: React.ReactNode;
}) {
  const panes = Children.toArray(children);
  // Open on the first tab that actually has something in it — landing on an
  // empty "Hosting" when you have three events on Saturday is the wrong
  // first impression.
  const [active, setActive] = useState(
    () => (tabs.find((t) => t.count > 0) ?? tabs[0])?.id ?? ""
  );
  const index = tabs.findIndex((t) => t.id === active);

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

      <div className="mt-5">{index >= 0 ? panes[index] : null}</div>
    </div>
  );
}

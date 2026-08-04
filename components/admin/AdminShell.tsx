"use client";

import { Children, useEffect, useState } from "react";

export interface AdminSection {
  id: string;
  label: string;
  emoji: string;
  /** Count worth chasing — pending reservations, open flags. */
  badge?: number;
  /** Group heading in the rail. */
  group: string;
}

/**
 * One screen, one job.
 *
 * The admin page stacked sixteen panels vertically, so finding anything meant
 * scrolling past everything, and every panel that fetches on mount fired on
 * every visit. This renders a rail and mounts ONLY the open section — the
 * others aren't hidden, they don't exist, so their queries never run.
 *
 * Children must be in the same order as `sections`.
 */
export default function AdminShell({
  sections,
  children,
}: {
  sections: AdminSection[];
  children: React.ReactNode;
}) {
  const panes = Children.toArray(children);
  const [active, setActive] = useState(sections[0]?.id ?? "");

  // Survive a reload — an admin mid-task shouldn't be dropped back at the top.
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    const saved = fromHash || localStorage.getItem("admin:section") || "";
    if (saved && sections.some((s) => s.id === saved)) setActive(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(id: string) {
    setActive(id);
    try {
      localStorage.setItem("admin:section", id);
      history.replaceState(null, "", `#${id}`);
    } catch {
      /* private mode — the tab still switches */
    }
  }

  const index = sections.findIndex((s) => s.id === active);
  const current = sections[index];

  // Rail entries grouped, preserving the order they were declared in.
  const groups: { name: string; items: AdminSection[] }[] = [];
  for (const s of sections) {
    const g = groups.find((x) => x.name === s.group);
    if (g) g.items.push(s);
    else groups.push({ name: s.group, items: [s] });
  }

  return (
    <div className="mt-6 gap-6 lg:flex">
      {/* --- rail: horizontal chips on a phone, a sidebar on a desktop --- */}
      <nav
        aria-label="Admin sections"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:w-60 lg:shrink-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {groups.map((g) => (
          <div key={g.name} className="contents lg:block lg:mb-4">
            <p className="hidden px-3 pb-1 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 lg:block">
              {g.name}
            </p>
            {g.items.map((s) => {
              const on = s.id === active;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => open(s.id)}
                  aria-current={on}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition lg:w-full lg:text-left ${
                    on
                      ? "bg-brand text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 lg:bg-transparent lg:hover:bg-gray-100"
                  }`}
                >
                  <span aria-hidden>{s.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  {s.badge ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${
                        on ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {s.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* --- the one open section --- */}
      <section className="min-w-0 flex-1">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
          <span aria-hidden>{current?.emoji}</span>
          {current?.label}
          {current?.badge ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              {current.badge} pending
            </span>
          ) : null}
        </h2>
        {index >= 0 ? panes[index] : null}
      </section>
    </div>
  );
}

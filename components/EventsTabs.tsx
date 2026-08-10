"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

type TabKey = "all" | "foryou" | "work" | "past";

const TABS: { key: TabKey; label: string }[] = [
  { key: "foryou", label: "For you" },
  { key: "all", label: "All events" },
  // Conferences, summits and expos live here rather than in the default feed.
  // They're a third of what's listed, so they need a door, just not the one
  // someone lands on expecting a beach day.
  { key: "work", label: "Meet & grow" },
  { key: "past", label: "Been and gone" },
];

/**
 * X-style tab bar: a full-width underline rail you can swipe between, rather
 * than a segmented pill.
 *
 * Swiping left/right moves to the neighbouring tab, which is how people expect
 * a feed to behave on a phone. The underline animates to the active tab.
 */
export default function EventsTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("tab");
  const tab: TabKey =
    raw === "foryou"
      ? "foryou"
      : raw === "work"
        ? "work"
        : raw === "past"
          ? "past"
          : "all";

  const href = (t: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (t === "all") params.delete("tab");
    else params.set("tab", t);
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  // --- swipe between tabs -------------------------------------------------
  const zone = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = zone.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;
      // Ignore anything that's really a vertical scroll — otherwise reading
      // the feed keeps flinging you into another tab.
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const i = TABS.findIndex((x) => x.key === tab);
      const next = dx < 0 ? i + 1 : i - 1;
      if (next < 0 || next >= TABS.length) return;
      router.push(href(TABS[next].key), { scroll: false });
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, searchParams, pathname]);

  const activeIndex = TABS.findIndex((t) => t.key === tab);

  return (
    <div ref={zone} className="relative -mx-4 sm:mx-0">
      <div className="no-scrollbar flex overflow-x-auto border-b border-gray-200 px-4 sm:px-0">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <Link
              key={t.key}
              href={href(t.key)}
              scroll={false}
              className={`relative shrink-0 whitespace-nowrap px-5 py-3 text-[15px] font-bold transition ${
                on ? "text-gray-900" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
              {on && (
                <span className="absolute inset-x-4 -bottom-px h-1 rounded-full bg-brand" />
              )}
            </Link>
          );
        })}
      </div>
      <p className="px-4 pt-1.5 text-[11px] text-gray-400 sm:hidden">
        Swipe to switch · {activeIndex + 1} of {TABS.length}
      </p>
    </div>
  );
}

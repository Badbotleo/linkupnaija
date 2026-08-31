"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
 * X-style tab bar: a full-width underline rail rather than a segmented pill.
 *
 * There used to be a swipe-to-change-tab gesture bound to this strip, and it
 * had to go. The strip is itself horizontally scrollable, because four labels
 * do not fit across a 375px phone, so the two gestures were the same gesture:
 * dragging sideways to bring "Been and gone" into view moved 60px, cleared the
 * swipe threshold, and navigated somewhere else instead. The row appeared to
 * move in every direction at once and taps landed on whatever had slid under
 * the finger.
 *
 * A tab bar is a place you aim at. It should hold still.
 */
export default function EventsTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

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

  // Bring the selected tab into view, because the strip scrolls and the tab
  // you are on can otherwise sit off the edge with no sign it is selected.
  //
  // scrollLeft on the strip rather than scrollIntoView: the latter would also
  // scroll the PAGE to bring the bar into view, which on arrival yanks the
  // feed out from under the reader.
  useEffect(() => {
    const strip = stripRef.current;
    const el = activeRef.current;
    if (!strip || !el) return;
    const target = el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [tab]);

  return (
    <div className="relative -mx-4 sm:mx-0">
      <div
        ref={stripRef}
        // Three separate things stop this row wandering on a phone, and it
        // needed all three.
        //
        // The four labels come to 486px against a 375px screen, so the strip
        // genuinely scrolls: 111px of travel. On iOS that means momentum, and
        // a flick meant to nudge it sends it to the end and bounces back.
        //
        //   snap-x/snap-mandatory  a fling settles on a tab instead of
        //                          wherever friction ran out
        //   overscroll-x-none      kills the rubber band, and with it the
        //                          drag that Safari reads as a back gesture
        //   scroll-pl-4            snapped tabs clear the container padding
        //                          rather than sitting under the edge
        className="no-scrollbar flex snap-x snap-mandatory scroll-pl-4 overflow-x-auto overscroll-x-none border-b border-gray-200 px-4 sm:px-0"
      >
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <Link
              key={t.key}
              ref={on ? activeRef : undefined}
              href={href(t.key)}
              scroll={false}
              aria-current={on ? "page" : undefined}
              // py-3.5 puts the target at 46px. The old py-3 gave 42, under
              // the 44px a thumb can be relied on to hit, on a row that was
              // also sliding while being aimed at.
              // px-3, down from px-4: 32px less travel across the row, which
              // is 32px less for a fling to run away with. The target is still
              // 46px tall, which is what a thumb actually needs.
              className={`relative shrink-0 snap-start whitespace-nowrap px-3 py-3.5 text-[15px] font-bold transition-colors ${
                on ? "text-gray-900" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
              {on && (
                <span className="absolute inset-x-3 -bottom-px h-1 rounded-full bg-brand" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

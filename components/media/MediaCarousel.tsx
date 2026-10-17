"use client";

import { useEffect, useRef, useState } from "react";
import LineIcon from "@/components/ui/LineIcon";

export interface MediaItem {
  url: string;
  type: "image" | "video";
  /** Still frame for a clip, where we have one. */
  poster?: string | null;
}

/**
 * Several photos and clips under one post, swiped.
 *
 * The shape everybody already knows, so nothing here is novel on purpose:
 * one item at a time, snap scrolling, dots underneath, a counter when there
 * is more than one. People arrive fluent in it.
 *
 * SCROLL SNAP, NOT A TRANSFORM. A carousel driven by translateX and a state
 * index has to reimplement momentum, rubber-banding and the trackpad, and
 * gets all three slightly wrong. The browser already does them: this is an
 * overflow-x container with snap points, and the index is READ from the
 * scroll position rather than driving it. Arrows and dots scroll the
 * container and let it report back.
 *
 * ONE VIDEO PLAYS AT A TIME. Every clip is muted, inline and paused, and
 * only the one you have swiped to is allowed to start. A carousel that plays
 * four videos at once on a Nigerian connection downloads four videos at once
 * and finishes none of them.
 *
 * A single item renders as a plain image or clip, with no dots, no counter
 * and no arrows: the furniture only exists when there is something to move
 * between.
 */
export default function MediaCarousel({
  items,
  className = "",
  rounded = "rounded-2xl",
}: {
  items: MediaItem[];
  className?: string;
  rounded?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // The index follows the scroll position, which is what makes a flick, an
  // arrow and a dot all end up agreeing without any of them being special.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        setIndex(Math.round(el.scrollLeft / w));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Pause everything that is not the current slide. Also runs on first
  // render, which is what stops slide two autoplaying behind slide one.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.querySelectorAll("video").forEach((v, i) => {
      if (i !== index) {
        v.pause();
        // Rewound so coming back to it starts from the top rather than from
        // wherever it was when you swiped away mid-clip.
        try {
          v.currentTime = 0;
        } catch {
          /* Safari throws before metadata lands. Not worth handling. */
        }
      }
    });
  }, [index]);

  if (items.length === 0) return null;

  const go = (to: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(items.length - 1, to));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  const many = items.length > 1;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={track}
        className={`no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain ${rounded}`}
      >
        {items.map((m, i) => (
          <div key={`${m.url}-${i}`} className="w-full shrink-0 snap-center">
            {m.type === "video" ? (
              <video
                src={m.url}
                poster={m.poster ?? undefined}
                controls
                muted
                playsInline
                preload={i === 0 ? "metadata" : "none"}
                className="block h-full w-full bg-black object-contain"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={m.url}
                alt=""
                // Only the first is eager: the rest are a swipe away and
                // loading all of them is the whole post's weight at once.
                loading={i === 0 ? "eager" : "lazy"}
                className="block h-full w-full object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {many && (
        <>
          <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur">
            {index + 1}/{items.length}
          </span>

          {/* Shown from sm up. On a touchscreen the swipe is the control and
              arrows sitting over the artwork are just clutter. */}
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous"
              className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 sm:grid"
            >
              <LineIcon name="chevronLeft" size={18} />
            </button>
          )}
          {index < items.length - 1 && (
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next"
              className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 sm:grid"
            >
              <LineIcon name="chevronRight" size={18} />
            </button>
          )}

          <div className="mt-2 flex items-center justify-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-4 bg-brand"
                    : "w-1.5 bg-gray-300 dark:bg-white/25"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

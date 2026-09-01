"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import EventCover from "../EventCover";
import { formatEventDate } from "@/lib/format";

export interface FeaturedEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  location: string | null;
  state: string | null;
  cover_image_url: string | null;
}

/**
 * Full-bleed hero carousel with dot indicators — the panel Pinterest opens
 * with, carrying our own events instead of mood boards.
 *
 * Scroll-snap does the paging, so the swipe is the browser's own and stays
 * smooth on a cheap phone; the dots only read scroll position back. No
 * transform maths, no per-frame React state.
 */
export default function FeaturedCarousel({
  events,
}: {
  events: FeaturedEvent[];
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Follow the scroll rather than driving it.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setIndex(Math.max(0, Math.min(events.length - 1, i)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [events.length]);

  function go(i: number) {
    const el = rail.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  if (events.length === 0) return null;

  return (
    <div className="-mx-4 mt-5 sm:mx-0">
      <div
        ref={rail}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="relative block h-[230px] w-full shrink-0 snap-center overflow-hidden sm:h-[280px] sm:rounded-3xl"
          >
            <div className="absolute inset-0">
              <EventCover
                url={e.cover_image_url}
                category={e.category}
                title={e.title}
                className="h-full w-full"
              />
            </div>
            {/* Covers are dense flyers carrying their own headline type, so
                the bottom third goes near-solid — our words have to win. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/15" />

            <div className="absolute inset-x-0 bottom-0 p-5 text-center sm:p-6">
              {/* Two lines maximum: long Nigerian event titles otherwise grow
                  the block until it covers the whole cover. */}
              <p className="mx-auto line-clamp-2 max-w-md text-[21px] font-extrabold leading-[1.15] tracking-[-0.02em] text-white sm:text-[26px]">
                {e.title}
              </p>
              <p className="mx-auto mt-1.5 line-clamp-1 max-w-md text-[13px] font-semibold text-white/70">
                {formatEventDate(e.date)}
                {e.location ? ` · ${e.location}` : e.state ? ` · ${e.state}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {events.map((e, i) => (
          <button
            key={e.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to ${e.title}`}
            aria-current={i === index}
            className={`h-2 rounded-full transition-colors ${
              i === index ? "w-2 bg-gray-800" : "w-2 bg-gray-300 hover:bg-gray-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

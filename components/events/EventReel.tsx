"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import EventCover from "../EventCover";
import CategoryBadge from "../CategoryBadge";
import LineIcon from "../ui/LineIcon";
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import { attendanceProof } from "@/lib/social-proof";
import { track } from "@/lib/analytics";
import type { EventRow } from "@/lib/types";

/**
 * One link-up per screen, scrolled vertically. The TikTok gesture, not the
 * Tinder one.
 *
 * The obvious reference for this is a swipe deck, and it is the wrong one at
 * this size. A deck promises there is always another card; with roughly two
 * dozen live events nationally, a visitor in Abuja exhausts their city in
 * fifteen seconds and lands on an empty state, which advertises how thin the
 * catalogue is rather than hiding it. Vertical scrolling makes no such
 * promise, so a short reel reads as a curated week instead of a dead app.
 *
 * It also keeps the three things a deck throws away:
 *
 *  - Nothing is discarded. "Not this Saturday" is not "never", and on this
 *    much inventory we cannot afford to bin a listing on one flick.
 *  - Every slide is still a real <a href>, so sharing to the group chat and
 *    the back button both behave.
 *  - The grid underneath is untouched and remains what crawlers read, which
 *    matters because the event structured data is aimed at Google's events
 *    carousel and a crawler cannot swipe.
 *
 * It opens as a full-screen layer rather than a panel in the page. Sat in the
 * flow it measured 1503px down an 812px viewport, below the search, the tabs,
 * the location banner, the featured carousel and the stories rail — an
 * immersive feed you have to scroll two screens to reach is not one. This is
 * the sixth thing in this codebase to be portalled to <body> for the same
 * reason: `position: fixed` resolves against a transformed ancestor, and the
 * page has several.
 *
 * Slides are sized in svh (small viewport height), which is the height with
 * browser chrome EXPANDED, so a CTA can never end up underneath a collapsing
 * address bar. Most of this traffic arrives inside the TikTok and Instagram
 * in-app browsers, where that bar behaves least predictably.
 */

export type ReelEvent = EventRow & {
  attendeeCount: number;
};

export default function EventReel({
  events,
  onClose,
}: {
  events: ReelEvent[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Escape closes, and the page behind must not scroll while this is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!mounted || events.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Link-ups, one per screen"
    >
      <div
        ref={scrollerRef}
        className="h-[100svh] snap-y snap-mandatory overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {events.map((event, i) => (
          <Slide
            key={event.id}
            event={event}
            first={i === 0}
            showHint={i === 0 && events.length > 1}
            scrollerRef={scrollerRef}
          />
        ))}

        {/* The end of a short reel needs somewhere to land, or the last slide
            just refuses to move and reads as broken. */}
        <div className="flex h-[100svh] snap-start flex-col items-center justify-center gap-4 bg-gradient-to-b from-gray-900 to-black px-8 text-center">
          <p className="text-4xl" aria-hidden>
            🎉
          </p>
          <h3 className="text-xl font-bold text-white">
            That&apos;s everything coming up
          </h3>
          <p className="max-w-xs text-sm text-white/60">
            Nothing here for you? The quickest fix is to start one. It takes a
            couple of minutes.
          </p>
          <Link href="/host" className="btn-primary mt-1">
            Host a link-up
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 text-sm font-semibold text-white/60 underline underline-offset-4"
          >
            Back to the grid
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close reel"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
      >
        <LineIcon name="x" size={20} />
      </button>
    </div>,
    document.body
  );
}

function Slide({
  event,
  first,
  showHint,
  scrollerRef,
}: {
  event: ReelEvent;
  first: boolean;
  showHint: boolean;
  scrollerRef: React.RefObject<HTMLDivElement>;
}) {
  const ref = useRef<HTMLElement>(null);
  // Only slides near the viewport own an image.
  //
  // Rendering the whole reel at once mounted 48 <img> elements on 24 events,
  // two per slide because `contain` draws a blurred backdrop behind the
  // flyer. That was enough to stall the renderer completely: a click on the
  // launcher timed out twice before this existed. Browser-native lazy loading
  // does not save you, because the cost is in mounting and laying out the
  // elements, not only in fetching them.
  //
  // It releases as well as claims. A one-way gate measured 14 images after
  // two slides and would have rebuilt the full 48 over a complete pass, which
  // is the same bill arriving slowly. Two-way keeps it at about three slides
  // whatever the catalogue grows to. Nothing flickers on the way back up: the
  // margin below mounts a slide a full screen before it is visible, and by
  // then the file is in the browser cache.
  const [near, setNear] = useState(first);

  useEffect(() => {
    const el = ref.current;
    const root = scrollerRef.current;
    if (!el || !root) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      // One screen of warning in each direction, so the image is decoded
      // before the flick that reveals it lands.
      { root, rootMargin: "100% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollerRef]);

  const proof = attendanceProof(event.attendeeCount, {
    capacity: event.max_attendees,
    createdAt: event.created_at,
    past: !!event.date && event.date < new Date().toISOString().slice(0, 10),
  });

  return (
    <article
      ref={ref}
      className="flex h-[100svh] w-full snap-start justify-center overflow-hidden bg-black"
    >
      {/* A phone-width column, letterboxed on desktop the way every vertical
          video player does it. Full-bleed on a wide monitor the flyer grew to
          fill 1200px, which put the category and state chips on top of the
          artwork's own headline and left the copy stranded across the bottom
          of a very wide box. */}
      <div className="flex w-full max-w-[440px] flex-col">
      {/* Two regions, not one image with text floating on it.
          Overlaid, the copy had to sit somewhere in a frame whose usable area
          depends entirely on the flyer's aspect ratio: a square flyer scaled
          to fit a phone-shaped slide leaves more than half the height empty,
          and no fixed offset is right for both that and a tall poster. Giving
          the text its own row and letting the image take whatever is left
          means neither can ever land on the other. */}
      <div className="relative min-h-0 flex-1">
        {/* contain, not cover: most of these are portrait flyers with the
            details printed on them, and cropping one hides the thing the host
            made it to say. The blurred backdrop fills the gaps. */}
        {near && (
          <EventCover
            url={event.cover_image_url}
            category={event.category}
            title={event.title}
            className="absolute inset-0 h-full w-full"
            fit="contain"
            priority={first}
          />
        )}

        {/* Melts the image into the panel so the join is not a hard line. */}
        <div
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent"
          aria-hidden
        />

        <div className="absolute inset-x-0 top-0 flex flex-wrap items-start gap-1.5 p-4 pr-16 pt-[max(1rem,env(safe-area-inset-top))]">
          <CategoryBadge category={event.category} className="shadow-sm" />
          <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {event.state}
          </span>
        </div>
      </div>

      <div className="w-full shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
        {/* In the flow, not floating over it. Absolutely positioned it landed
            straight on top of the date and location lines. */}
        {showHint && (
          <p
            className="mb-2 animate-bounce text-[11px] font-semibold uppercase tracking-wider text-white/55"
            aria-hidden
          >
            Scroll for more ↓
          </p>
        )}
        <h3 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-white">
          {event.title}
        </h3>

        <dl className="mt-2.5 space-y-1 text-[15px] text-white/85">
          <div className="flex items-center gap-2">
            <LineIcon name="calendar" size={15} className="shrink-0 text-white/50" />
            <span>
              {formatEventDate(event.date)} ·{" "}
              {formatEventTimeRange(
                event.time,
                (event as { end_time?: string | null }).end_time
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LineIcon name="pin" size={15} className="shrink-0 text-white/50" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        </dl>

        {/* Price reads as a fact about the night, alongside when and where.
            It spent a version sitting in its own grey pill next to the CTA,
            where it competed with the button for the same glance and made the
            row look like two half-decisions instead of one. */}
        <div className="mt-1 flex items-center gap-2">
          <LineIcon name="ticket" size={15} className="shrink-0 text-white/50" />
          <span className="text-[15px] font-bold text-white">
            {event.price > 0 ? formatNaira(event.price) : "Free entry"}
          </span>
          {proof && (
            <>
              <span className="text-white/25" aria-hidden>
                ·
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[15px] font-bold ${
                  proof.tone === "urgent" ? "text-red-400" : "text-white/70"
                }`}
              >
                {proof.tone === "urgent" && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-red-400"
                    aria-hidden
                  />
                )}
                {proof.label}
              </span>
            </>
          )}
        </div>

        {/* One target, full width, lifted off the flyer.
            The glow is brand-coloured rather than black so the button reads as
            lit from within against a photo that could be any colour, and the
            hairline along the top edge is what keeps it from looking flat when
            the image behind it is bright. */}
        <Link
          href={`/events/${event.id}`}
          onClick={() => track("reel_open_event", { event_id: event.id })}
          className="group relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-700 px-6 py-4 text-[17px] font-extrabold tracking-[-0.01em] text-white shadow-[0_12px_32px_-12px_rgba(83,74,183,0.95)] ring-1 ring-white/25 transition-transform duration-150 active:scale-[0.985]"
        >
          <span
            className="absolute inset-x-0 top-0 h-px bg-white/40"
            aria-hidden
          />
          See this link-up
          <span
            className="translate-x-0 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden
          >
            →
          </span>
        </Link>
      </div>
      </div>
    </article>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import EventCover from "../EventCover";
import LineIcon from "../ui/LineIcon";
import { groupForCategory } from "@/lib/category-groups";
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

/**
 * Height of one slide.
 *
 * The server-rendered fallback, used until the measurement below runs and on
 * the rare load where it cannot.
 *
 * Underscores, not spaces, and the spaces matter: CSS calc() requires
 * whitespace around a minus, so `calc(100svh-23rem)` is invalid and the
 * browser drops the declaration in silence. Tailwind's arbitrary-value syntax
 * forbids literal spaces, so an underscore is how you write one. Without it
 * the height never applied at all, slides fell back to auto, and the reel
 * rendered as 4,688px of stacked cards with every snap point meaningless.
 *
 * svh, not vh or dvh: svh is the viewport with browser chrome EXPANDED, so a
 * CTA can never be swallowed by a collapsing address bar. Most of this traffic
 * arrives inside the TikTok and Instagram in-app browsers, where that bar
 * behaves least predictably.
 */
const INLINE_SLIDE =
  "h-[calc(100svh_-_23rem)] min-h-[360px] lg:h-[calc(100svh_-_17rem)]";
const FULL_SLIDE = "h-[100svh]";

/** Breathing room between the join button and the bottom nav. */
const NAV_GAP = 12;

export default function EventReel({
  events,
  onClose,
  past = false,
}: {
  events: ReelEvent[];
  /** Omitted when the reel IS the feed rather than a layer over it. */
  onClose?: () => void;
  /** "Been and gone". Changes the closing card; the slides decide per event. */
  past?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [slidePx, setSlidePx] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const overlay = !!onClose;
  const slideHeight = overlay ? FULL_SLIDE : INLINE_SLIDE;

  useEffect(() => setMounted(true), []);

  /**
   * Size a slide to the space actually left, rather than to a guess.
   *
   * The fallback class subtracts a fixed 23rem for the furniture above the
   * reel and the fixed nav below it. That number was measured once on a
   * 375x812 screen, and it is wrong on every other one: the chrome above is
   * fixed pixels, so on a shorter phone it eats a far bigger share of the
   * viewport. It was already wrong here by 23px, which put the join button
   * underneath the bottom nav, visible in a screenshot and untappable on a
   * phone. The stories rail moving back above the feed shifted it again.
   *
   * Measuring removes the whole class of bug. Anything that changes the
   * chrome above the reel is now accounted for automatically, including the
   * next thing somebody adds to this page.
   */
  useEffect(() => {
    if (overlay) return; // the overlay is the whole viewport by definition

    const measure = () => {
      const el = scrollerRef.current;
      if (!el) return;
      // Absolute top, so the answer does not depend on where the page happens
      // to be scrolled when this runs.
      const top = el.getBoundingClientRect().top + window.scrollY;
      const nav = document.querySelector("[data-bottom-nav]");
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      // The floor is deliberately low. A generous one looks like caution and
      // behaves like a bug: on a 375x667 phone the furniture above the reel
      // leaves 244px, so a 360px floor pushed the join button 84px underneath
      // the nav, which is the exact failure this measurement exists to stop.
      // Better a compact slide that is entirely tappable than a handsome one
      // whose button cannot be reached.
      setSlidePx(Math.max(240, Math.round(window.innerHeight - top - navH - NAV_GAP)));
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [overlay]);

  // minHeight as well as height, and it is not redundant: the fallback class
  // carries min-h, which outranks an inline height and silently pinned every
  // slide to the floor. On a 375x667 screen the measurement said 244px, the
  // class said 360px, the class won, and the join button went back under the
  // nav with the measuring code apparently working.
  const sizeStyle =
    slidePx && !overlay
      ? { height: `${slidePx}px`, minHeight: `${slidePx}px` }
      : undefined;

  // Escape closes, and the page behind must not scroll while this is open.
  // Neither applies when the reel is the page's own feed.
  useEffect(() => {
    if (!onClose) return;
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

  if (events.length === 0) return null;
  // The overlay cannot render until there is a <body> to portal into. Inline
  // there is no such wait, and there must not be: rendered on the server the
  // slides put 24 real <a href> event links in the HTML, which is what keeps
  // the structured data on those pages reachable now that the crawlable grid
  // is no longer on this page.
  if (overlay && !mounted) return null;

  const reel = (
    <>
      <div
        ref={scrollerRef}
        style={sizeStyle}
        className={`${slideHeight} snap-y snap-mandatory overflow-y-auto overscroll-y-contain ${
          overlay ? "" : "rounded-3xl"
        } [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {events.map((event, i) => (
          <Slide
            key={event.id}
            event={event}
            first={i === 0}
            showHint={i === 0 && events.length > 1}
            scrollerRef={scrollerRef}
            heightClass={slideHeight}
            heightStyle={sizeStyle}
            compact={!!slidePx && slidePx < 340}
          />
        ))}

        {/* The end of a short reel needs somewhere to land, or the last slide
            just refuses to move and reads as broken. */}
        <div
          style={sizeStyle}
          className={`${slideHeight} flex snap-start flex-col items-center justify-center gap-4 bg-gradient-to-b from-gray-900 to-black px-8 text-center`}
        >
          <p className="text-4xl" aria-hidden>
            🎉
          </p>
          <h3 className="text-xl font-bold text-white">
            {past ? "That's the story so far" : "That's everything coming up"}
          </h3>
          <p className="max-w-xs text-sm text-white/60">
            {past
              ? "Every one of these was somebody's idea first. The next one could be yours."
              : "Nothing here for you? The quickest fix is to start one. It takes a couple of minutes."}
          </p>
          <Link href="/host" className="btn-primary mt-1">
            Host a link-up
          </Link>
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reel"
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          <LineIcon name="x" size={20} />
        </button>
      )}
    </>
  );

  if (!overlay) {
    return (
      <section
        aria-label="Link-ups, one per screen"
        className="overflow-hidden rounded-3xl bg-black"
      >
        {reel}
      </section>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Link-ups, one per screen"
    >
      {reel}
    </div>,
    document.body
  );
}

function Slide({
  event,
  first,
  showHint,
  scrollerRef,
  heightClass,
  heightStyle,
  compact = false,
}: {
  event: ReelEvent;
  first: boolean;
  showHint: boolean;
  scrollerRef: React.RefObject<HTMLDivElement>;
  heightClass: string;
  /** Measured height, once the reel knows it. Overrides heightClass. */
  heightStyle?: { height: string; minHeight: string };
  /**
   * The slide is too short to afford the full panel.
   *
   * The panel is shrink-0 and the image takes what is left, so on a 375x667
   * phone the panel claimed all 244px and the flyer rendered at exactly zero
   * pixels: a reel of link-ups with no artwork in it, which is most of the
   * reason to have a reel. Rather than shrink everything everywhere, the
   * short case drops the two lines that are decoration here (the chips, which
   * repeat what the flyer says, and the address, which nobody chooses a night
   * by) and keeps the four that decide it: what, when, how much, and the way
   * in.
   */
  compact?: boolean;
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

  const group = groupForCategory(event.category);
  // Per event, not per tab: the feed can hold both, and a slide should not
  // depend on which door you came through.
  const isPast =
    !!event.date && event.date < new Date().toISOString().slice(0, 10);
  const proof = attendanceProof(event.attendeeCount, {
    capacity: event.max_attendees,
    createdAt: event.created_at,
    past: isPast,
  });

  return (
    <article
      ref={ref}
      style={heightStyle}
      className={`${heightClass} flex w-full snap-start justify-center overflow-hidden bg-black`}
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
            made it to say. The blurred backdrop fills the gaps.

            Except when the box is short, where contain is self-defeating: a
            portrait flyer fitted whole into a 100px-tall strip is rendered
            about 70px wide, an unreadable stamp adrift in black. Cover at
            least shows a legible band of the artwork. */}
        {near && (
          <EventCover
            url={event.cover_image_url}
            category={event.category}
            title={event.title}
            className="absolute inset-0 h-full w-full"
            fit={compact ? "cover" : "contain"}
            priority={first}
          />
        )}

        {/* Melts the image into the panel so the join is not a hard line. */}
        <div
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent"
          aria-hidden
        />

      </div>

      <div
        className={`w-full shrink-0 px-5 pt-1 ${
          compact
            ? "pb-[max(0.6rem,env(safe-area-inset-bottom))]"
            : "pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        }`}
      >
        {/* Labels live in the panel, not over the artwork.
            Sat on the image they covered whatever the host had put in that
            corner, which on a flyer is usually the date. And it is the family,
            not the category: there are 106 categories, and the long ones
            ("Rave / Electronic / Themed Night") wrapped onto a second line
            across the poster. Six families read at a glance and are the same
            words the vibe filters use. */}
        <div className={`${compact ? "hidden" : "mb-2 flex"} items-center gap-1.5`}>
          <span className="truncate rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {group ? `${group.emoji} ${group.label}` : event.category}
          </span>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-sm">
            {event.state}
          </span>
          {showHint && (
            <span
              className="ml-auto shrink-0 animate-bounce text-[11px] font-semibold uppercase tracking-wider text-white/45"
              aria-hidden
            >
              Scroll ↓
            </span>
          )}
        </div>
        <h3
          className={`${
            compact ? "line-clamp-1 text-[19px]" : "text-[24px]"
          } font-extrabold leading-tight tracking-[-0.02em] text-white`}
        >
          {event.title}
        </h3>

        <dl
          className={`${
            compact ? "mt-1" : "mt-2.5"
          } space-y-1 text-[15px] text-white/85`}
        >
          <div className="flex items-center gap-2">
            <LineIcon name="calendar" size={15} className="shrink-0 text-white/50" />
            <span className="line-clamp-1">
              {formatEventDate(event.date)} ·{" "}
              {formatEventTimeRange(
                event.time,
                (event as { end_time?: string | null }).end_time
              )}
            </span>
          </div>
          {/* The address is the first thing to go when space is short: it is
              how you get there, not how you decide to. */}
          {!compact && (
            <div className="flex items-center gap-2">
              <LineIcon name="pin" size={15} className="shrink-0 text-white/50" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}
        </dl>

        {/* Price reads as a fact about the night, alongside when and where.
            It spent a version sitting in its own grey pill next to the CTA,
            where it competed with the button for the same glance and made the
            row look like two half-decisions instead of one. */}
        <div className="mt-1 flex items-center gap-2">
          {/* A finished night has no price worth quoting. What it has is a
              turnout, so on the past tab the ticket line gives way to the one
              number that still means something. */}
          {!isPast && (
            <>
              <LineIcon
                name="ticket"
                size={15}
                className="shrink-0 text-white/50"
              />
              <span className="text-[15px] font-bold text-white">
                {event.price > 0 ? formatNaira(event.price) : "Free entry"}
              </span>
            </>
          )}
          {proof && (
            <>
              {!isPast && (
                <span className="text-white/25" aria-hidden>
                  ·
                </span>
              )}
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
            the image behind it is bright.

            On a past night the label asks for the only thing left to ask for:
            the pictures. Selling a ticket to something that already happened
            is the one way this button can be a lie.

            The label is otherwise the one waiting on the event page, not a
            description of the navigation. "See this link-up" asked for a look,
            which is the thing 1,800 visitors already did before 29 joined; this
            asks for the decision, and lands on a button that says the same
            words back, so there is no seam between wanting to go and going. */}
        <Link
          href={`/events/${event.id}`}
          onClick={() => track("reel_open_event", { event_id: event.id })}
          className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-700 px-6 text-[17px] font-extrabold tracking-[-0.01em] text-white shadow-[0_12px_32px_-12px_rgba(83,74,183,0.95)] ring-1 ring-white/25 transition-transform duration-150 active:scale-[0.985] ${
            // Never below 44px tall: that is the minimum a thumb can be relied
            // on to hit, and this is the only thing on the slide worth tapping.
            compact ? "mt-2 py-3" : "mt-4 py-4"
          }`}
        >
          <span
            className="absolute inset-x-0 top-0 h-px bg-white/40"
            aria-hidden
          />
          {isPast
            ? "See how it went"
            : event.price > 0
              ? "Get a ticket"
              : "Ask to join"}
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

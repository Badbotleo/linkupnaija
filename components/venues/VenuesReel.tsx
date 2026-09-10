"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LineIcon from "@/components/ui/LineIcon";
import VenueArt from "./VenueArt";

/**
 * One venue per screen, scrolled vertically.
 *
 * The onboarded venues were a swipe deck: a horizontal rail of 356px cards.
 * That shape is right for three or four spots and wrong for forty, which is
 * what the admin importer produces in an afternoon. A rail asks you to
 * compare things side by side, and it makes the fortieth venue roughly
 * unreachable, because nobody swipes a rail forty times.
 *
 * A reel asks you to react instead, one place at a time, and the gesture is
 * the one everybody already has in their thumb.
 *
 * THE FEATURED VENUE IS NOT IN HERE. It keeps its own card above. A reel
 * flattens everything it contains to equal weight, which is exactly what you
 * do not want for the one spot you are being paid to push.
 *
 * Two things carried over from ThingsReel, both learned the hard way:
 *
 *  - Slides are measured, not guessed. The chrome above is fixed pixels, so
 *    a fraction of the viewport is wrong on every phone but the one it was
 *    written on, and the CTA ends up under the bottom nav.
 *  - The counter reads scroll position rather than an IntersectionObserver.
 *    Every slide flown past reports isIntersecting, the callbacks batch, and
 *    the last in the batch wins whether or not it is still on screen.
 *
 * ON THE ARTWORK. Imported venues have no photograph: the importer refuses to
 * copy Google's, and its own note says so. So most slides draw VenueArt
 * instead. That is honest but it is not what a reel is for, and it is the
 * strongest argument for letting a venue upload its own pictures.
 */

export interface ReelVenue {
  id: string;
  name: string;
  category: string;
  address: string | null;
  state: string | null;
  image: string | null;
  description: string | null;
  price: string | null;
  rating: number | null;
  /** "Open · till 22:00", already resolved. */
  hours: string | null;
}

/** Breathing room between the button and the bottom nav. */
const NAV_GAP = 12;

/**
 * Room left above the reel so its heading stays on screen.
 *
 * ThingsReel measures from its own position down the document, which is
 * right there because it starts near the top of its page. Copied here it
 * broke: this reel sits below the featured deck, several hundred pixels into
 * the document, so innerHeight minus that offset went negative and every
 * slide collapsed to the 240px floor. A mid-page reel has to size itself
 * from the VIEWPORT, not from where it happens to sit in the document.
 */
const HEADROOM = 132;

export default function VenuesReel({
  venues,
  ctaLabel,
  onReserve,
}: {
  venues: ReelVenue[];
  /** "Book a table" at a restaurant, "Reserve seats" at a cinema. */
  ctaLabel: (venue: ReelVenue) => string;
  onReserve: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [slidePx, setSlidePx] = useState<number | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!scrollerRef.current) return;
      const nav = document.querySelector("[data-bottom-nav]");
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      // Capped as well as floored. On a desktop the venues list shares a row
      // with the map, and an 900px-tall slide there is a poster, not a card.
      const h = window.innerHeight - navH - NAV_GAP - HEADROOM;
      setSlidePx(Math.round(Math.min(720, Math.max(360, h))));
    };
    measure();
    // Again next frame, and again once the page settles: the first pass can
    // land before the bottom nav has laid out, and a nav height of zero is
    // exactly the mistake that puts the CTA underneath it.
    const raf = requestAnimationFrame(measure);
    const later = window.setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(later);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const h = scroller.clientHeight || 1;
        setActive(Math.round(scroller.scrollTop / h));
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [venues.length]);

  if (venues.length === 0) return null;

  // minHeight as well as height: the fallback class carries a min-h that
  // outranks a bare inline height and would pin every slide to the floor.
  const size = slidePx
    ? { height: `${slidePx}px`, minHeight: `${slidePx}px` }
    : undefined;

  // Underscores, not spaces. calc() needs whitespace around the minus and
  // Tailwind arbitrary values cannot contain literal spaces, so
  // calc(100svh-14rem) is invalid and silently dropped.
  const fallback = "h-[calc(100svh_-_14rem)] min-h-[360px]";

  return (
    <div className="relative mx-auto max-w-[460px]">
      <div
        ref={scrollerRef}
        tabIndex={0}
        aria-label="Venues, one per screen"
        className={`${fallback} snap-y snap-mandatory overflow-y-auto overscroll-y-contain rounded-3xl bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        style={size}
      >
        {venues.map((v, i) => (
          <article
            key={v.id}
            data-slide={i}
            style={size}
            className={`${fallback} relative w-full snap-start overflow-hidden`}
          >
            {v.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={v.image}
                alt=""
                /* The first slide is the one being looked at; lazy-loading it
                   means an empty screen on arrival. */
                loading={i === 0 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <VenueArt
                name={v.name}
                category={v.category}
                className="absolute inset-0 h-full w-full"
              />
            )}

            {/* The copy sits on whatever picture this is, so it cannot rely
                on the image being dark. */}
            <div
              className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/75 to-transparent"
              aria-hidden
            />

            <div className="absolute inset-x-0 top-0 flex flex-wrap items-start gap-1.5 p-4 pr-20">
              <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                {v.category}
              </span>
              {v.state && (
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white/85 backdrop-blur-sm">
                  {v.state}
                </span>
              )}
              {v.hours && (
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white/85 backdrop-blur-sm">
                  {v.hours}
                </span>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0 p-5 pb-6">
              <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">
                {v.name}
              </h2>

              {v.address && (
                <p className="mt-2 flex items-center gap-2 text-[15px] text-white/85">
                  <LineIcon
                    name="pin"
                    size={15}
                    className="shrink-0 text-white/50"
                  />
                  <span className="line-clamp-1">{v.address}</span>
                </p>
              )}

              {/* Rating and price are the two things people actually compare,
                  and a reel took away their ability to see them side by side.
                  So they go on the slide rather than behind a tap. */}
              {(v.rating !== null || v.price) && (
                <p className="mt-2 flex items-center gap-3 text-[14px] font-semibold text-white/85">
                  {v.rating !== null && (
                    <span className="inline-flex items-center gap-1 text-[#FAC775]">
                      <LineIcon name="star" size={13} filled />
                      {v.rating.toFixed(1)}
                    </span>
                  )}
                  {v.price && <span>{v.price}</span>}
                </p>
              )}

              {v.description && (
                <p className="mt-2 line-clamp-2 text-[14px] leading-snug text-white/70">
                  {v.description}
                </p>
              )}

              <button
                type="button"
                onClick={() => onReserve(v.id)}
                className="group relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-700 px-6 py-4 text-[17px] font-extrabold tracking-[-0.01em] text-white shadow-[0_12px_32px_-12px_rgba(83,74,183,0.95)] ring-1 ring-white/25 transition-transform duration-150 active:scale-[0.985]"
              >
                <span
                  className="absolute inset-x-0 top-0 h-px bg-white/40"
                  aria-hidden
                />
                {ctaLabel(v)}
              </button>

              {/* A real link under the button, for the same reason the things
                  reel has one: nothing here should be reachable only by
                  scrolling to it, and a venue should be shareable. */}
              <Link
                href={`/venues/${v.id}`}
                // Hex, not text-white. globals.css rewrites themed colours
                // under .dark, and this sits on a photograph, which is dark
                // in either theme.
                className="mt-2.5 block text-center text-[14px] font-bold text-[#ffffff]/70 underline-offset-4 hover:underline"
              >
                See the venue
              </Link>
            </div>
          </article>
        ))}

        {/* A short reel needs somewhere to land, or the last slide refuses to
            move and reads as broken. */}
        <div
          style={size}
          className={`${fallback} flex snap-start flex-col items-center justify-center gap-4 bg-gradient-to-b from-gray-900 to-black px-8 text-center`}
        >
          <p className="text-4xl" aria-hidden>
            🍽️
          </p>
          <h2 className="text-xl font-bold text-white">
            That&apos;s every spot we can book here
          </h2>
          <p className="max-w-xs text-sm text-white/60">
            Run a place yourself? Get it on here and take reservations from
            people planning their night.
          </p>
          {/* An email, not /venues/claim. That route is the venue-owner
              onboarding that has not been built yet, and a CTA pointing at a
              404 is worse than one that opens a mail app. Swap it the day
              claiming exists. */}
          <a
            href="mailto:support@linkupnaija.com?subject=Add%20my%20venue"
            className="btn-primary mt-1"
          >
            Add your venue
          </a>
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
        {Math.min(active + 1, venues.length)} / {venues.length}
      </div>
    </div>
  );
}

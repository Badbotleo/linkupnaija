"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LineIcon from "@/components/ui/LineIcon";
import LazyMedia from "@/components/home/LazyMedia";

/**
 * One place per screen, scrolled vertically. The same gesture the events reel
 * uses, for the same reason.
 *
 * A grid of ideas asks you to compare; a reel asks you to react. Deciding
 * where to go on a Saturday is the second kind of decision, and the artwork
 * is most of what makes it: a photograph of a rooftop at 268px in a shelf is
 * a thumbnail, and the same photograph filling a phone is an invitation.
 *
 * Two things this deliberately keeps from the events reel, because both were
 * learned the hard way there:
 *
 *  - Slides are measured, not guessed. The chrome above this is fixed pixels,
 *    so a fraction of the viewport is wrong on every phone that is not the
 *    one it was written on, and a CTA can end up under the bottom nav.
 *  - Every slide is a real <a href>. Nothing is discarded by scrolling past,
 *    and a link can be shared into a group chat.
 *
 * The shelf on the home pages stays a shelf. This is the page you land on
 * when you tap through, the way the events reel is the feed and the stories
 * rail is the taster.
 */

export interface ReelIdea {
  key: string;
  title: string;
  place: string;
  category: string;
  image: string;
  mediaType: "image" | "video";
  state: string | null;
  href: string;
  liveCount?: number;
  /** Where the link-ups already running here live. */
  liveHref?: string;
  /** The artwork already carries its own wording; do not caption it. */
  hideLabel?: boolean;
}

/** Breathing room between the button and the bottom nav. */
const NAV_GAP = 12;

export default function ThingsReel({ ideas }: { ideas: ReelIdea[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [slidePx, setSlidePx] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = scrollerRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const nav = document.querySelector("[data-bottom-nav]");
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      setSlidePx(
        Math.max(240, Math.round(window.innerHeight - top - navH - NAV_GAP))
      );
    };
    measure();
    // Again on the next frame, and again once the page has settled. The first
    // pass can land before the bottom nav has laid out, and a nav height of
    // zero is exactly the mistake that puts the CTA underneath it.
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

  if (ideas.length === 0) return null;

  // minHeight as well as height: the fallback class carries a min-h that
  // outranks a bare inline height and would pin every slide to the floor.
  const size = slidePx
    ? { height: `${slidePx}px`, minHeight: `${slidePx}px` }
    : undefined;

  // Underscores, not spaces. calc() requires whitespace around the minus and
  // Tailwind's arbitrary values cannot contain literal spaces, so
  // calc(100svh-14rem) is invalid and silently dropped.
  const fallback = "h-[calc(100svh_-_14rem)] min-h-[360px]";

  return (
    <div className="relative mx-auto max-w-[460px]">
      <div
        ref={scrollerRef}
        tabIndex={0}
        aria-label="Places to go, one per screen"
        className={`${fallback} snap-y snap-mandatory overflow-y-auto overscroll-y-contain rounded-3xl bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        style={size}
      >
        {ideas.map((idea, i) => (
          <article
            key={idea.key}
            data-slide={i}
            style={size}
            className={`${fallback} relative w-full snap-start overflow-hidden`}
          >
            <LazyMedia
              src={idea.image}
              kind={idea.mediaType}
              className="absolute inset-0"
            />

            {/* The copy sits on whatever photograph this is, so it cannot
                rely on the image being dark. */}
            <div
              className={`absolute inset-x-0 bottom-0 bg-gradient-to-t ${
                idea.hideLabel
                  ? "h-2/5 from-black via-black/60 to-transparent"
                  : "h-3/5 from-black via-black/75 to-transparent"
              }`}
              aria-hidden
            />

            <div className="absolute inset-x-0 top-0 flex flex-wrap items-start gap-1.5 p-4 pr-20">
              <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                {idea.category}
              </span>
              {idea.state && (
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white/85 backdrop-blur-sm">
                  {idea.state}
                </span>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0 p-5 pb-6">
              {/* An upload with burned-in text gets no caption. A title over
                  one collides with the wording already in the artwork. */}
              {!idea.hideLabel && (
                <>
                  <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">
                    {idea.title}
                  </h2>
                  <p className="mt-2 flex items-center gap-2 text-[15px] text-white/85">
                    <LineIcon
                      name="pin"
                      size={15}
                      className="shrink-0 text-white/50"
                    />
                    <span className="line-clamp-1">{idea.place}</span>
                  </p>
                </>
              )}

              {/* Two doors, carried over from the grid this replaced.
                  "Host it" is a big ask for somebody browsing ideas, and when
                  a link-up is already running here, joining one is the far
                  smaller step. It leads for exactly that reason. */}
              {!!idea.liveCount && idea.liveCount > 0 && idea.liveHref && (
                <Link
                  href={idea.liveHref}
                  // Hex, not bg-white/text-gray-900. globals.css rewrites both
                  // under .dark, and this button sits on a photograph, which
                  // is dark whatever the theme is. Themed classes turned it
                  // into a near-invisible grey slab on a black slide.
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ffffff] px-6 py-3.5 text-[16px] font-extrabold text-[#111827] transition-transform duration-150 active:scale-[0.985]"
                >
                  <LineIcon name="calendar" size={16} />
                  {idea.liveCount} on now
                </Link>
              )}

              <Link
                href={idea.href}
                className="group relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-700 px-6 py-4 text-[17px] font-extrabold tracking-[-0.01em] text-white shadow-[0_12px_32px_-12px_rgba(83,74,183,0.95)] ring-1 ring-white/25 transition-transform duration-150 active:scale-[0.985]"
              >
                <span
                  className="absolute inset-x-0 top-0 h-px bg-white/40"
                  aria-hidden
                />
                {idea.liveCount ? "Or host your own" : "Host it here"}
                <span
                  className="transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden
                >
                  →
                </span>
              </Link>
            </div>
          </article>
        ))}

        {/* The end of a short reel needs somewhere to land, or the last slide
            refuses to move and reads as broken. */}
        <div
          style={size}
          className={`${fallback} flex snap-start flex-col items-center justify-center gap-4 bg-gradient-to-b from-gray-900 to-black px-8 text-center`}
        >
          <p className="text-4xl" aria-hidden>
            📍
          </p>
          <h2 className="text-xl font-bold text-white">
            That&apos;s everywhere we know about
          </h2>
          <p className="max-w-xs text-sm text-white/60">
            Somewhere missing? Host a link-up there and it goes on the map.
          </p>
          <Link href="/host" className="btn-primary mt-1">
            Host a link-up
          </Link>
        </div>
      </div>

    </div>
  );
}

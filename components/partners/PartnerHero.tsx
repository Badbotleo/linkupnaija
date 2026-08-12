"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The swipeable poster wall at the top of a partner page.
 *
 * A single hero can only ever show the current night. Partners run these
 * monthly, and the back catalogue is the proof they actually happen, so the
 * hero holds every flyer and you swipe through them.
 *
 * Slides come in two kinds, both already branded:
 *   1. /api/ig-card/<eventId> — the LinkUpNaija square the admin panel
 *      generates, so the partner's poster carries our mark without a second
 *      image pipeline existing to maintain.
 *   2. Anything in partners.poster_urls — their own flyers, past ones
 *      included.
 */
/** Posters can be clips now, so the hero has to play them. */
const isVideo = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

export default function PartnerHero({
  slides,
  brand,
}: {
  slides: { src: string; label: string }[];
  brand: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);

  // Which one is in view. Reading scrollLeft rather than tracking taps keeps
  // the dots honest when somebody flings past two at once.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setActive(Math.max(0, Math.min(slides.length - 1, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slides.length]);

  // Play only what's on screen. Autoplay attributes alone would start every
  // clip at once, and these run to 15MB apiece.
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) {
        v.muted = true;
        // Rejects on some autoplay policies even when muted. A still first
        // frame beats an exception nobody sees.
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [active, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className="relative" style={{ backgroundColor: brand }}>
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {slides.map((s, i) => (
          <div key={s.src} className="w-full shrink-0 snap-center">
            {isVideo(s.src) ? (
              /* Muted + playsInline is what lets it autoplay at all; without
                 both, Safari shows a paused black frame. */
              <video
                ref={(n) => {
                  videos.current[i] = n;
                }}
                src={s.src}
                muted
                loop
                playsInline
                // NEVER "none" here. This carried autoPlay AND
                // preload="none", which is a contradiction: the browser was
                // told to start playing and to fetch nothing, so an
                // off-screen clip never loaded and never played. Metadata is
                // enough to paint a first frame; the effect below starts the
                // one you've actually swiped to.
                preload="metadata"
                aria-label={s.label}
                className="mx-auto max-h-[78vh] w-full object-contain"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={s.src}
                alt={s.label}
                // contain, not cover: a flyer cropped to fill is a flyer with
                // its date cut off, which is the one thing it exists to say.
                className="mx-auto max-h-[78vh] w-full object-contain"
                loading={i === 0 ? "eager" : "lazy"}
              />
            )}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <span
                key={s.src}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? "w-5 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {active + 1} / {slides.length}
          </span>
        </>
      )}
    </div>
  );
}

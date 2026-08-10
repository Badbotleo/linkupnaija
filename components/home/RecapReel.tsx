"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import LineIcon from "../ui/LineIcon";
import { formatEventDate } from "@/lib/format";
import type { Recap } from "@/lib/recaps";

/**
 * Recap footage, shaped like the thing everyone already knows how to use.
 *
 * Two surfaces. A horizontal shelf of 9:16 cards on the page, and a
 * full-screen vertical player you land in when you tap one — snap-scroll
 * between clips, sound on, tap to pause. People arrive here already fluent in
 * it, which is the point: no one has to learn how to look at our videos.
 *
 * ON SOUND. Browsers refuse to autoplay audio, and rightly — a home page that
 * starts talking at you is a home page you close. So the shelf is muted and
 * only the full-screen player has sound, because opening it is a tap, and a
 * tap is the user gesture that earns the right to make noise. The mute button
 * is always visible and the choice sticks as you scroll between clips.
 */
export default function RecapReel({ recaps }: { recaps: Recap[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  return (
    <>
      {/* No scroller of our own — Rail already supplies the snapping
          horizontal one, and nesting two makes the cards impossible to swipe. */}
      {recaps.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setOpenAt(i)}
            aria-label={`Play recap${r.event ? ` from ${r.event.title}` : ""}`}
            className="group w-[45vw] max-w-[172px] shrink-0 snap-start text-left"
          >
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-gray-900 shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
              {r.mediaType === "video" ? (
                /* Muted + playsInline is what lets this autoplay at all;
                   without both, Safari shows a paused black frame. */
                <video
                  src={r.mediaUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={r.mediaUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}

              <div
                className={`absolute inset-0 bg-gradient-to-t ${
                  r.title || r.event
                    ? "from-black/80 via-black/10 to-black/25"
                    : "from-black/45 via-transparent to-black/25"
                }`}
              />

              <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-900">
                <LineIcon name="check" size={10} />
                Happened
              </span>

              {r.mediaType === "video" && (
                <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                  <LineIcon name="play" size={11} />
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                {r.title && (
                  <p className="line-clamp-2 text-[13px] font-extrabold leading-tight">
                    {r.title}
                  </p>
                )}
                {r.event && (
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-white/85">
                    {r.event.title}
                  </p>
                )}
              </div>
            </div>
        </button>
      ))}

      {openAt !== null && (
        <ReelsPlayer
          recaps={recaps}
          startAt={openAt}
          onClose={() => setOpenAt(null)}
        />
      )}
    </>
  );
}

function ReelsPlayer({
  recaps,
  startAt,
  onClose,
}: {
  recaps: Recap[];
  startAt: number;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [current, setCurrent] = useState(startAt);
  // Sound on by default: we only got here from a tap, which is exactly the
  // gesture browsers require before audio is allowed.
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);

  // Jump to the tapped clip.
  //
  // This used to compute `startAt * el.clientHeight`, which ran before layout
  // had settled — clientHeight was still wrong, so the scroll landed between
  // two clips and the observer reported one index while a different video was
  // on screen. Tapping card 2 played card 1 under card 2's caption. Scrolling
  // the actual element into view can't drift like that.
  useLayoutEffect(() => {
    const el = scroller.current;
    const target = el?.querySelector<HTMLElement>(`[data-index="${startAt}"]`);
    target?.scrollIntoView({ block: "start" });
  }, [startAt]);

  // Lock the page behind the overlay — otherwise the feed scrolls underneath.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Only the clip you're looking at plays. Without this every video in the
  // list plays at once and they all fight over the audio.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const i = Number((entry.target as HTMLElement).dataset.index);
          if (entry.isIntersecting && entry.intersectionRatio > 0.6)
            setCurrent(i);
        }
      },
      { root: el, threshold: [0.6] }
    );
    el.querySelectorAll("[data-index]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [recaps.length]);

  // Everything playing on the page behind us is now covered by a black
  // overlay, so it's audio and battery spent on nothing. Paused for as long
  // as the player is open, resumed on close.
  useEffect(() => {
    const root = scroller.current;
    const behind = Array.from(document.querySelectorAll("video")).filter(
      (v) => !root?.contains(v)
    );
    behind.forEach((v) => v.pause());
    return () => {
      behind.forEach((v) => v.play().catch(() => {}));
    };
  }, []);

  /**
   * Start the current clip, with sound if the browser allows it.
   *
   * play() returns a promise that REJECTS when autoplay policy blocks audio,
   * and the first version treated one rejection as the end of the story — so
   * on any browser that blocks it (which includes every automated one) the
   * player opened to a frozen frame and nothing ever played. Falling back to
   * muted is always allowed, and a silent video beats a still image.
   */
  const playCurrent = useCallback(() => {
    const v = videos.current[current];
    if (!v || paused) return;
    v.muted = muted;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    });
  }, [current, muted, paused]);

  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v || i === current) return;
      v.pause();
      v.currentTime = 0;
    });
    const v = videos.current[current];
    if (!v) return;
    if (paused) {
      v.pause();
      return;
    }
    playCurrent();
  }, [current, paused, playCurrent]);

  const active = recaps[current];
  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  // Portalled to <body>. z-index alone wasn't enough: this renders deep inside
  // the page, and any ancestor with a transform or filter traps it in that
  // stacking context — which is why the navbar and bottom nav kept drawing
  // over a z-[9999] overlay. Mounted on body there is no ancestor to trap it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black">
      <div
        ref={scroller}
        className="no-scrollbar h-[100dvh] snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {recaps.map((r, i) => (
          <div
            key={r.id}
            data-index={i}
            className="relative h-[100dvh] w-full snap-start"
          >
            {r.mediaType === "video" ? (
              <video
                ref={(n) => {
                  videos.current[i] = n;
                }}
                src={r.mediaUrl}
                loop
                playsInline
                preload={Math.abs(i - current) <= 1 ? "auto" : "none"}
                // The effect above can run before the element has enough of
                // the file to start; this catches that case.
                onLoadedData={() => {
                  if (i === current) playCurrent();
                }}
                onClick={() => setPaused((p) => !p)}
                className="h-full w-full object-contain"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={r.mediaUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            )}
          </div>
        ))}
      </div>

      {/* Controls sit above the scroller so they don't scroll away. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm"
        >
          <LineIcon name="chevronLeft" size={20} />
        </button>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
            {current + 1} / {recaps.length}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={!muted}
            className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm"
          >
            <LineIcon name={muted ? "volumeOff" : "volume"} size={18} />
          </button>
        </div>
      </div>

      {paused && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm"
        >
          <LineIcon name="play" size={28} />
        </span>
      )}

      {active && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pb-8 text-white">
          {active.title && (
            <p className="text-[17px] font-extrabold leading-tight">
              {active.title}
            </p>
          )}
          {active.event ? (
            <Link
              href={`/events/${active.event.id}`}
              className="pointer-events-auto mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-white/90 underline-offset-4 hover:underline"
            >
              {active.event.title}
              <LineIcon name="chevronRight" size={13} />
            </Link>
          ) : null}
          <p className="mt-0.5 text-xs text-white/60">
            {active.event ? formatEventDate(active.event.date) : ""}
            {active.state ? ` · ${active.state}` : ""}
            {active.credit ? ` · ${active.credit}` : ""}
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}

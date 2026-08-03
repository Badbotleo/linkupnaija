"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import LineIcon from "../ui/LineIcon";

/**
 * A Tinder-style card deck: one card face-up, the rest stacked behind it,
 * and you fling it away to see the next one.
 *
 * Unlike the horizontal shelves elsewhere on the page, this is one thing at a
 * time — which is the point for content people should actually read rather
 * than skim past.
 *
 * Works with a mouse, a finger and a keyboard. Auto-advances on its own until
 * you touch it, then hands control over and stays out of the way.
 */

const SWIPE_THRESHOLD = 90; // px before a release counts as a swipe
const AUTO_MS = 4500;
const RESUME_AFTER_MS = 9000;

export default function SwipeDeck({
  children,
  className = "h-[228px]",
}: {
  children: React.ReactNode;
  /** Height of the deck — cards fill it, so pick one that fits the tallest. */
  className?: string;
}) {
  const cards = Children.toArray(children);
  const count = cards.length;

  const [top, setTop] = useState(0);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<0 | 1 | -1>(0);
  const [dragging, setDragging] = useState(false);
  const topCard = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // Drag state lives in refs, not state: pointermove can land in the same
  // React batch as pointerdown, and a state closure would still read the old
  // value and drop the gesture. State mirrors it only for rendering.
  const startX = useRef(0);
  const draggingRef = useRef(false);
  const dxRef = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const advance = useCallback(
    (dir: 1 | -1) => {
      setFlying(dir);
      // Let the card clear the frame before it goes to the back of the deck.
      setTimeout(() => {
        setTop((t) => (t + (dir === 1 ? 1 : count - 1)) % count);
        setFlying(0);
        setDx(0);
      }, 220);
    },
    [count]
  );

  /** Any human input pauses the timer; it comes back after a quiet spell. */
  const holdAuto = useCallback(() => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), RESUME_AFTER_MS);
  }, []);

  // Auto-advance, but never for someone who asked for reduced motion, and
  // never while the deck is off-screen.
  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let visible = true;
    const el = box.current;
    const io = el
      ? new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
          threshold: 0.4,
        })
      : null;
    if (el && io) io.observe(el);

    const t = setInterval(() => {
      if (visible) advance(1);
    }, AUTO_MS);
    return () => {
      clearInterval(t);
      io?.disconnect();
    };
  }, [paused, advance, count]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    []
  );

  function onPointerDown(e: React.PointerEvent) {
    if (flying) return;
    holdAuto();
    draggingRef.current = true;
    dxRef.current = 0;
    setDragging(true);
    startX.current = e.clientX;
    // Throws NotFoundError if the pointer id isn't currently active — which
    // must not abort the drag, since capture is an optimisation, not a
    // requirement.
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* drag still works without capture */
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    dxRef.current = e.clientX - startX.current;
    // Deliberately NOT setDx here: a state update per pointermove re-renders
    // every card in the deck ~60x a second and the drag visibly stutters.
    // The top card is moved directly instead, and React is told once on
    // release.
    const node = topCard.current;
    if (node) {
      node.style.transform = `translateX(${dxRef.current}px) rotate(${
        dxRef.current / 22
      }deg)`;
    }
  }

  function onPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const moved = dxRef.current;
    dxRef.current = 0;
    // Hand the card back to React's transform, which the re-render sets.
    const node = topCard.current;
    if (node) node.style.transform = "";
    if (Math.abs(moved) > SWIPE_THRESHOLD) advance(moved > 0 ? -1 : 1);
    else setDx(0); // snap back
  }

  function nudge(dir: 1 | -1) {
    if (flying) return;
    holdAuto();
    advance(dir);
  }

  if (count === 0) return null;

  return (
    <div className="container-page mt-3">
      {/* Capped width: a deck stretched to 1088px on a desktop reads as a
          banner, not a card you'd flick away. */}
      <div
        ref={box}
        className={`relative mx-auto w-full max-w-xl select-none ${className}`}
        style={{ touchAction: "pan-y" }}
      >
        {cards.map((card, i) => {
          // Where this card sits in the stack right now: 0 = face-up.
          const depth = (i - top + count) % count;
          if (depth > 2) return null;

          const isTop = depth === 0;
          const offset = flying && isTop ? flying * 520 : isTop ? dx : 0;
          const rotate = isTop ? offset / 22 : 0;

          return (
            <div
              key={i}
              ref={isTop ? topCard : undefined}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerUp : undefined}
              className={`absolute inset-0 ${
                isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
              }`}
              style={{
                zIndex: count - depth,
                transform: `translateX(${offset}px) translateY(${depth * 10}px) scale(${
                  1 - depth * 0.04
                }) rotate(${rotate}deg)`,
                opacity: flying && isTop ? 0 : 1,
                // No transition mid-drag or the card lags behind the finger.
                transition: dragging && isTop ? "none" : "transform .28s ease, opacity .22s ease",
                // Promote to its own layer so dragging never repaints the
                // photo underneath — the difference between smooth and not.
                willChange: isTop ? "transform" : undefined,
                backfaceVisibility: "hidden",
              }}
              aria-hidden={!isTop}
            >
              {card}
            </div>
          );
        })}
      </div>

      {/* Controls — a deck you can only fling is unusable with a keyboard */}
      {count > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Previous card"
            className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-brand/40 hover:text-brand"
          >
            <LineIcon name="chevronLeft" size={16} />
          </button>

          <div className="flex gap-1.5">
            {cards.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === top ? "w-5 bg-brand" : "w-1.5 bg-gray-300"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Next card"
            className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-brand/40 hover:text-brand"
          >
            <LineIcon name="chevronRight" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

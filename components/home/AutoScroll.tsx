"use client";

import { useEffect, useRef } from "react";

/**
 * Gently auto-advances a horizontal shelf so the page shows movement without
 * the visitor having to touch anything — the trick postedapp.com uses.
 *
 * Deliberately restrained: it pauses the moment a person interacts (pointer,
 * touch, focus or manual scroll), stops when the shelf is off-screen so
 * background rails don't burn battery, and does nothing at all for anyone who
 * has asked for reduced motion.
 */
export default function AutoScroll({
  children,
  speed = 0.35,
}: {
  children: React.ReactNode;
  /** Pixels per animation frame. */
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let pos = el.scrollLeft;
    let paused = false;
    let visible = true;
    let idle: ReturnType<typeof setTimeout> | null = null;

    // Any human input wins; resume only after they've stopped for a moment.
    const hold = () => {
      paused = true;
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => {
        // Pick up from wherever they left it, not where we last were.
        pos = el.scrollLeft;
        paused = false;
      }, 2500);
    };

    const io = new IntersectionObserver(
      ([e]) => (visible = e.isIntersecting),
      { threshold: 0.1 }
    );
    io.observe(el);

    const step = () => {
      if (!paused && visible && el.scrollWidth > el.clientWidth + 4) {
        const end = el.scrollWidth - el.clientWidth;
        // Loop back to the start rather than stalling at the end.
        pos = pos >= end - 1 ? 0 : pos + speed;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const events = ["pointerdown", "wheel", "touchstart", "focusin", "mouseenter"] as const;
    events.forEach((e) => el.addEventListener(e, hold, { passive: true }));

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      if (idle) clearTimeout(idle);
      events.forEach((e) => el.removeEventListener(e, hold));
    };
  }, [speed]);

  return (
    <div
      ref={ref}
      // No scroll-snap here: proximity snapping drags a sub-pixel drift
      // straight back to the nearest card, so the shelf never advances.
      className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-8"
    >
      {children}
      <span aria-hidden className="w-1 shrink-0" />
    </div>
  );
}

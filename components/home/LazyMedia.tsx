"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A card's media, fetched only once it's about to be seen.
 *
 * This exists because of a real bill. Storage held 117MB; Supabase reported
 * 18GB of cached egress against a 5GB quota — the same bytes going out ~154
 * times over. Two causes, and this is the bigger one: every card in a
 * horizontal shelf mounted with a src and autoPlay, so opening the home page
 * started downloading EVERY clip in the rail at once, whether or not you ever
 * scrolled to it. Eight cards of phone video is tens of megabytes a visit.
 *
 * A <video> with no src costs nothing. One with a src costs its whole file.
 * So the src arrives with the card, and playback follows visibility.
 */
export default function LazyMedia({
  src,
  kind,
  poster,
  className = "",
  alt = "",
}: {
  src: string;
  kind: "image" | "video";
  poster?: string;
  className?: string;
  alt?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        // rootMargin starts the fetch just before it arrives, so swiping
        // never waits on a blank card.
        if (entry.isIntersecting) setNear(true);
        setVisible(entry.intersectionRatio > 0.5);
      },
      { rootMargin: "300px", threshold: [0, 0.5] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Only what you're looking at plays. Off-screen video that keeps running
  // keeps downloading, which is the bill again in a quieter form.
  useEffect(() => {
    const v = video.current;
    if (!v || !near) return;
    if (visible) v.play().catch(() => {});
    else v.pause();
  }, [near, visible]);

  return (
    <div ref={ref} className={className}>
      {kind === "video" ? (
        <video
          ref={video}
          // No src until it's near. This is the whole fix.
          src={near ? src : undefined}
          poster={poster}
          muted
          loop
          playsInline
          preload={near ? "metadata" : "none"}
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={near ? src : undefined}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      )}
    </div>
  );
}

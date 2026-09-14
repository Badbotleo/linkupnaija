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
 *
 * AND IT LEAVES AGAIN. `near` used to be a one-way latch: once a card had
 * been seen it kept its src for the life of the page. On a shelf of eight
 * that is free. On the Things to do reel it is 61 full-screen slides, and a
 * decoded 1080x1920 frame is about 8MB, so scrolling to the end left the tab
 * holding a few hundred megabytes and Safari killed the renderer. The symptom
 * is a black page reading "a problem repeatedly occurred", with no console
 * error, because the process that would have logged it is gone.
 *
 * So the margin is wide and the latch swings both ways: media within about
 * two slides either side stays, and anything further out gives its src back
 * for the browser to reclaim. Wide enough that ordinary scrolling never
 * refetches, which is what the bill above is about.
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
        // Both ways. Within the margin the media loads and stays; beyond it
        // the src is dropped so the frame can be collected.
        setNear(entry.isIntersecting);
        setVisible(entry.intersectionRatio > 0.5);
      },
      { rootMargin: "1200px", threshold: [0, 0.5] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Only what you're looking at plays. Off-screen video that keeps running
  // keeps downloading, which is the bill again in a quieter form.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (near && visible) {
      v.play().catch(() => {});
      return;
    }
    v.pause();
    // Leaving the margin drops the src, and a <video> holding a decoded
    // buffer for a file it no longer points at is the leak this is about.
    if (!near) {
      v.removeAttribute("src");
      v.load();
    }
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

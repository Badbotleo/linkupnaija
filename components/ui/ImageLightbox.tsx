"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LineIcon from "./LineIcon";

/**
 * Tap any picture to see the whole thing.
 *
 * A feed crops with object-cover so the timeline stays a timeline, which
 * means a tall photo is shown as a slice of itself. Every app people already
 * use expands on tap, so a picture that does nothing reads as broken rather
 * than as a thumbnail.
 *
 * The mechanics are AvatarLightbox's, which have been in production on the
 * profile header: portalled to <body>, escape closes, backdrop closes, body
 * scroll locked while open, and object-contain inside so the expanded view is
 * the uncropped photo — the entire reason for expanding it.
 *
 * Portalled deliberately. Feed rows sit inside overflow-hidden containers and
 * iOS Safari clips a position:fixed descendant of one; five components here
 * have hit that already.
 */
export default function ImageLightbox({
  src,
  alt = "",
  caption,
  className,
  children,
}: {
  src: string;
  alt?: string;
  /** Shown under the expanded image. Usually who posted it. */
  caption?: string | null;
  /** Classes for the trigger image, so the feed keeps its own crop. */
  className?: string;
  /** A custom trigger. Defaults to the image itself. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt ? `View ${alt} full size` : "View picture full size"}
        className="block w-full cursor-zoom-in"
      >
        {children ?? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} loading="lazy" className={className} />
        )}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={alt || "Picture"}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            >
              <LineIcon name="x" size={18} />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {caption && (
              <p className="absolute bottom-6 left-0 right-0 px-6 text-center text-sm font-semibold text-white/80">
                {caption}
              </p>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

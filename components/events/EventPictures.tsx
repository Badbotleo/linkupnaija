"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LineIcon from "../ui/LineIcon";

/**
 * The host's own pictures for an event, tappable.
 *
 * These were bare <img> tags in a scroller — a 112px thumbnail of a flyer
 * whose text you can't read is decoration, not information. The attendee
 * photo gallery further down the page had a lightbox all along, so tapping
 * one strip did nothing while tapping the other opened full screen, which is
 * the kind of inconsistency people read as broken.
 *
 * Portalled to <body>: this renders deep inside the page and an ancestor
 * stacking context would otherwise trap it under the nav.
 */
export default function EventPictures({
  urls,
  title,
}: {
  urls: string[];
  title: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % urls.length));
      if (e.key === "ArrowLeft")
        setOpen((i) => (i === null ? i : (i - 1 + urls.length) % urls.length));
    };
    window.addEventListener("keydown", onKey);
    // Stop the page scrolling behind the overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, urls.length, close]);

  if (urls.length === 0) return null;

  return (
    <>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open picture ${i + 2} of ${title}`}
            className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-36 sm:w-36"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${title} — picture ${i + 2}`}
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
            {/* Says it's tappable rather than leaving people to guess. */}
            <span className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
              <LineIcon name="eye" size={12} />
            </span>
          </button>
        ))}
      </div>

      {mounted &&
        open !== null &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4"
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label={`${title} pictures`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urls[open]}
              alt={`${title} — picture ${open + 2}`}
              // contain, not cover: a flyer cropped to fill is a flyer you
              // still can't read, which is the whole reason for opening it.
              className="max-h-[85vh] max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm"
            >
              <LineIcon name="chevronDown" size={20} />
            </button>

            {urls.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen((i) =>
                      i === null ? i : (i - 1 + urls.length) % urls.length
                    );
                  }}
                  className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm"
                >
                  <LineIcon name="chevronLeft" size={20} />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen((i) => (i === null ? i : (i + 1) % urls.length));
                  }}
                  className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm"
                >
                  <LineIcon name="chevronRight" size={20} />
                </button>
                <span className="absolute bottom-5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                  {open + 1} / {urls.length}
                </span>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

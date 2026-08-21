"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "../Avatar";
import LineIcon from "../ui/LineIcon";

/**
 * Tap a profile picture to see it full size.
 *
 * A 96px circle is a thumbnail of a photo someone chose carefully, and the
 * only way to see it properly was to open the file directly — which most
 * people won't think to do. Every app people already use expands it, so its
 * absence reads as the picture being broken rather than small.
 *
 * Portalled to <body>: profile headers sit inside overflow-hidden containers,
 * and iOS Safari clips a position:fixed descendant of one of those. Four
 * components in this codebase have hit that already.
 *
 * Falls back to the plain avatar when there's no photo — expanding a
 * generated initial to fill the screen is a joke at the user's expense.
 */
export default function AvatarLightbox({
  name,
  url,
  size = "lg",
  children,
}: {
  name: string | null;
  url: string | null;
  size?: "sm" | "md" | "lg";
  /** The trigger. Defaults to the same Avatar the page would have rendered. */
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

  const trigger = children ?? <Avatar name={name} url={url} size={size} />;

  if (!url) return <>{trigger}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${name ?? "profile"} picture full size`}
        className="block rounded-full transition active:scale-95"
      >
        {trigger}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${name ?? "Profile"} picture`}
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
              src={url}
              alt={name ?? "Profile picture"}
              // Contain, not cover: this is the one place the whole photo
              // should be visible, uncropped, which is the entire point of
              // expanding it.
              className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {name && (
              <p className="absolute bottom-6 left-0 right-0 text-center text-sm font-semibold text-white/80">
                {name}
              </p>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

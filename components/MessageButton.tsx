"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import MessageThread from "./MessageThread";

export default function MessageButton({
  meId,
  targetId,
  targetName,
  label = "Message",
  className,
}: {
  meId: string | null;
  targetId: string;
  targetName: string | null;
  /** Accepted for call-site convenience; the thread renders its own header. */
  targetAvatar?: string | null;
  label?: string;
  className?: string;
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

  const cls = className ?? "btn-outline flex-1 rounded-full py-2";

  if (!meId) {
    return (
      <Link href={`/login?redirect=/u/${targetId}`} className={cls}>
        {label}
      </Link>
    );
  }
  if (meId === targetId) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cls}>
        {label}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Chat with ${targetName ?? "member"}`}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-700 shadow-sm hover:bg-white"
                >
                  ✕ Close
                </button>
              </div>
              <MessageThread
                meId={meId}
                otherId={targetId}
                otherName={targetName ?? "Member"}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

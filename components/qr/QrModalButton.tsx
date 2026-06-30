"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QrCode from "./QrCode";

export default function QrModalButton({
  value,
  caption,
  fileName,
  copyValue,
  title = "Share via QR",
  buttonLabel = "Generate QR Code",
  buttonClassName,
}: {
  value: string;
  caption?: string;
  fileName?: string;
  copyValue?: string;
  title?: string;
  buttonLabel?: string;
  buttonClassName?: string;
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
        className={
          buttonClassName ??
          "inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        }
      >
        <QrIcon />
        {buttonLabel}
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
              aria-label={title}
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="mt-5">
                <QrCode
                  value={value}
                  caption={caption}
                  fileName={fileName}
                  copyValue={copyValue}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm0 4h3v2h-3v-2zm-5-4h3v3h-2v2h-2v-3h1v-2zm0 5h2v2h-2v-2zm5 0h3v3h-3v-3z" />
    </svg>
  );
}

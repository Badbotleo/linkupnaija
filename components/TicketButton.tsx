"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

// The attendee's QR ticket. The host scans it at the door (native camera),
// which opens /checkin/<rsvpId> and marks them present.
export default function TicketButton({
  rsvpId,
  eventTitle,
  attendeeName,
}: {
  rsvpId: string;
  eventTitle: string;
  attendeeName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const url = `${base.replace(/\/+$/, "")}/checkin/${rsvpId}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-outline flex w-full items-center justify-center gap-2 py-2.5"
      >
        <span aria-hidden>🎟️</span> Show my ticket
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold uppercase tracking-wide text-brand">
              Your ticket
            </p>
            <h2 className="mt-1 truncate text-lg font-extrabold text-gray-900">
              {eventTitle}
            </h2>
            <div className="mt-4 flex justify-center rounded-2xl bg-white p-4">
              <QRCodeCanvas value={url} size={200} level="M" includeMargin />
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {attendeeName ?? "Guest"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Show this at the door — the host scans it to check you in.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary mt-5 w-full"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeCanvas } from "qrcode.react";
import { QR_BRAND, QR_LOGO_SRC } from "@/lib/qr";
import LineIcon from "./ui/LineIcon";

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
  // createPortal needs a DOM to aim at, and this renders on the server first.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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
        <LineIcon name="ticket" size={16} />
        Show my ticket
      </button>

      {/* Portalled to <body>. The ticket card wraps this in
          `overflow-hidden rounded-3xl` to get its stub shape, and iOS Safari
          clips a position:fixed descendant of a clipping ancestor — so the
          modal opened and was immediately cropped out of existence. It worked
          on the event page, where no such ancestor exists, which is what made
          it look like an iPhone problem rather than a layout one. */}
      {mounted &&
        open &&
        createPortal(
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
              <QRCodeCanvas
                value={url}
                size={200}
                // "H" is not decoration. Punching a logo out of the middle
                // destroys modules, and at level M there isn't enough
                // redundancy left to survive it — the code still LOOKS fine
                // and stops scanning, which you'd discover at a door with a
                // queue behind you. H tolerates ~30% loss.
                level="H"
                includeMargin
                fgColor={QR_BRAND}
                imageSettings={{
                  src: QR_LOGO_SRC,
                  height: 44,
                  width: 44,
                  excavate: true,
                }}
              />
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {attendeeName ?? "Guest"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Show this at the door. The host scans it to check you in.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary mt-5 w-full"
            >
              Done
            </button>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}

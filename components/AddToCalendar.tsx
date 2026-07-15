"use client";

import { useEffect, useRef, useState } from "react";
import { googleCalendarUrl, icsDataUri, type CalendarEvent } from "@/lib/calendar";

// "Add to calendar" button with a small menu: Google Calendar (link) or
// Apple/Outlook (.ics download). The single biggest no-show reducer — puts the
// event on the user's phone with its own reminder.
export default function AddToCalendar({ event }: { event: CalendarEvent }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-outline flex w-full items-center justify-center gap-2 py-2.5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        Add to calendar
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg"
        >
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand"
          >
            📅 Google Calendar
          </a>
          <a
            href={icsDataUri(event)}
            download={`${event.title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block border-t border-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand"
          >
            🍎 Apple / Outlook (.ics)
          </a>
        </div>
      )}
    </div>
  );
}

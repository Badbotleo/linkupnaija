"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { MapEvent } from "./EventsMap";

// Leaflet must not render on the server.
const EventsMap = dynamic(() => import("./EventsMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] w-full place-items-center rounded-2xl border border-gray-100 bg-gray-50 text-sm text-gray-400">
      Loading map…
    </div>
  ),
});

// "Map view" toggle for the events page — see where link-ups are happening
// across Nigeria.
export default function EventsMapToggle({ events }: { events: MapEvent[] }) {
  const [open, setOpen] = useState(false);
  const states = new Set(events.map((e) => e.state)).size;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-outline flex items-center gap-2 py-2"
        aria-expanded={open}
      >
        <span aria-hidden>🗺️</span>
        {open ? "Hide map" : `Map view · ${events.length} across ${states} state${states === 1 ? "" : "s"}`}
      </button>
      {open && (
        <div className="mt-4">
          <EventsMap events={events} />
        </div>
      )}
    </div>
  );
}

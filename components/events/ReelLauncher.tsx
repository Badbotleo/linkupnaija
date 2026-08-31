"use client";

import { useState } from "react";
import LineIcon from "../ui/LineIcon";
import EventReel, { type ReelEvent } from "./EventReel";
import { track } from "@/lib/analytics";

/**
 * The way into the reel, and the only thing about it that sits in the page.
 *
 * It lives high, directly under the tabs, because the reel is a browsing MODE
 * rather than a section of the feed: an entry point below the fold would only
 * ever be found by people who had already scrolled, who are exactly the people
 * who did not need it.
 *
 * The grid stays the default and stays server-rendered. That is deliberate on
 * two counts: it is what crawlers read, so the event structured data keeps
 * working, and it is what somebody arriving cold from a poster QR meets — a
 * page of options they can compare at a glance rather than a single card that
 * hides how much is on.
 */
export default function ReelLauncher({ events }: { events: ReelEvent[] }) {
  const [open, setOpen] = useState(false);

  if (events.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          track("reel_open", { events: events.length });
        }}
        className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white transition-transform active:scale-[0.98] dark:bg-white dark:text-gray-900"
      >
        <LineIcon name="play" size={15} />
        Reel
        <span className="font-medium opacity-60">one at a time</span>
      </button>

      {open && <EventReel events={events} onClose={() => setOpen(false)} />}
    </>
  );
}

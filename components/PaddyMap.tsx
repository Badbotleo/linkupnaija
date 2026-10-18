"use client";

import Link from "next/link";
import LineIcon from "@/components/ui/LineIcon";

/**
 * Everywhere you can go, as a thing you tap.
 *
 * Paddy used to answer "what can you do" by typing out a seven item bulleted
 * list, each behind a keyboard emoji, each ending in a raw slash path
 * rendered as the link text. That is a sitemap with a face on it: slow to
 * produce, different every time, impossible to style, and it read like a
 * directory rather than a friend.
 *
 * So the map is the app's, not the model's. It is drawn once, in the
 * product's own glyphs, always says the same thing, and every tile is a real
 * destination rather than a sentence about one. The model is now told never
 * to list features, which is only reasonable because this exists.
 *
 * Shown on the empty thread, where somebody who opened the chat without a
 * question in mind actually needs it, and gone the moment a conversation
 * starts: a menu over a live conversation is clutter.
 */
const PLACES: {
  href: string;
  icon: string;
  label: string;
  note: string;
  tone: string;
}[] = [
  {
    href: "/events",
    icon: "calendar",
    label: "What's on",
    note: "On this week",
    tone: "text-brand",
  },
  {
    href: "/venues",
    icon: "pin",
    label: "Venues",
    note: "Book the spot",
    tone: "text-[#A07A2C]",
  },
  {
    href: "/circles",
    icon: "circles",
    label: "Circles",
    note: "Your people",
    tone: "text-brand",
  },
  {
    href: "/rides",
    icon: "car",
    label: "Rides",
    note: "Split the fare",
    tone: "text-naija",
  },
  {
    href: "/host",
    icon: "mic",
    label: "Host",
    note: "Run your own",
    tone: "text-brand",
  },
  {
    href: "/refer",
    icon: "gift",
    label: "Invite",
    note: "You both earn",
    tone: "text-naija",
  },
];

export default function PaddyMap({ onPick }: { onPick?: () => void }) {
  return (
    <div className="pl-9">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
        Or go straight there
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PLACES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            onClick={onPick}
            className="group flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition hover:border-brand/40 hover:bg-brand-50/40 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-50 ${p.tone} dark:bg-white/10`}
            >
              <LineIcon name={p.icon} size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-gray-900 group-hover:text-brand dark:text-white">
                {p.label}
              </span>
              <span className="block truncate text-[11px] text-gray-500">
                {p.note}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

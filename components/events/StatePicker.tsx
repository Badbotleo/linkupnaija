"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import LineIcon from "../ui/LineIcon";

/**
 * Where the feed is scoped, as a list you choose from.
 *
 * The location pill used to be a two-way toggle. With a state detected it read
 * "Lagos" and tapping it widened to "All Nigeria"; tapping that put Lagos
 * back. Those were the only two places the header could ever offer, which is
 * why somebody in Abuja could not get to Abuja from it. The full state list
 * did exist, in a <select> inside the vibe filters, but those sit below the
 * reel now, and the reel is a snap container with overscroll-y-contain
 * standing most of a viewport tall, so in practice nothing under it is
 * reachable on a phone.
 *
 * Only states with an upcoming link-up are offered, so no option here leads
 * to an empty feed.
 *
 * Portalled to <body>, which is the seventh time in this codebase for the same
 * reason: `position: fixed` resolves against a transformed ancestor, and this
 * page has several.
 */
export default function StatePicker({
  states,
  current,
  closeHref,
  allHref,
}: {
  /**
   * Already paired with their hrefs.
   *
   * This took a `hrefFor(state)` callback for one revision, which a Server
   * Component cannot pass: functions are not serialisable across that
   * boundary, and the page died with "Something went wrong" rather than
   * anything naming the cause. The URLs are built on the server now.
   */
  states: { label: string; href: string }[];
  /** The state in force, or null for all of Nigeria. */
  current: string | null;
  closeHref: string;
  allHref: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The page behind must not scroll while this is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-label="Choose a location"
        className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl dark:bg-[#161616]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200 sm:hidden dark:bg-white/15" />

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
            Where are you?
          </h2>
          <Link
            href={closeHref}
            scroll={false}
            className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/70"
            aria-label="Close"
          >
            <LineIcon name="x" size={16} />
          </Link>
        </div>

        <div className="max-h-[55vh] space-y-1 overflow-y-auto">
          <Option
            href={allHref}
            label="All Nigeria"
            active={!current}
            closeHref={closeHref}
          />
          {states.map((s) => (
            <Option
              key={s.label}
              href={s.href}
              label={s.label}
              active={current === s.label}
              closeHref={closeHref}
            />
          ))}
        </div>

        {states.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">
            Nothing is coming up anywhere just yet.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

function Option({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
  closeHref: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      // 48px tall. This is a list people aim at on a phone.
      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-bold transition-colors ${
        active
          ? "bg-brand text-white"
          : "text-gray-800 hover:bg-gray-50 dark:text-white/85 dark:hover:bg-white/5"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <LineIcon
          name="pin"
          size={16}
          className={active ? "text-white/80" : "text-gray-400"}
        />
        {label}
      </span>
      {active && <LineIcon name="check" size={16} />}
    </Link>
  );
}

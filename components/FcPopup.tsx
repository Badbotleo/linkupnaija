"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "fc26_dismissed_at";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 12_000; // let people read the page first

// Compact, low-key promo toast for the FC26 tournament. Deliberately small:
// it should feel like a nudge, not a takeover.
export default function FcPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(KEY);
      if (dismissed && Date.now() - Number(dismissed) < WEEK_MS) return;
    } catch {
      // ignore storage errors
    }
    const t = setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100vw-2rem)] max-w-xs -translate-x-1/2 animate-fade-in-up sm:left-auto sm:right-5 sm:translate-x-0">
      <div
        className="relative flex items-center gap-3 rounded-2xl border border-white/10 p-3.5 pr-9 text-white shadow-xl"
        style={{ backgroundColor: "#0F0A2E" }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/10 text-xs text-white/70 transition hover:bg-white/20 hover:text-white"
        >
          ✕
        </button>

        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-xl" aria-hidden>
          🎮
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-snug">
            FC26 Tournament · Abuja · ₦2M prize
          </p>
          <Link
            href="/tournament"
            onClick={dismiss}
            className="mt-0.5 inline-block text-xs font-semibold text-[#AFA9EC] underline-offset-2 hover:underline"
          >
            40 slots only · Register →
          </Link>
        </div>
      </div>
    </div>
  );
}

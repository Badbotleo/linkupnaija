"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "fc26_dismissed_at";
const DAY_MS = 24 * 60 * 60 * 1000;

export default function FcPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(KEY);
      if (dismissed && Date.now() - Number(dismissed) < DAY_MS) return;
    } catch {
      // ignore storage errors
    }
    const t = setTimeout(() => setShow(true), 2000);
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
    <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0">
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-brand p-5 text-white shadow-2xl"
        style={{ backgroundColor: "#0F0A2E" }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
        >
          ✕
        </button>

        <p className="text-sm font-black tracking-wide text-[#7F77DD]">
          🎮 FC26 TOURNAMENT — ABUJA
        </p>
        <p className="mt-2 text-2xl font-extrabold leading-tight">
          ₦2,000,000 PRIZE
        </p>
        <p className="text-sm font-semibold text-white/80">
          40 PLAYERS ONLY
        </p>
        <p className="mt-2 text-xs text-white/60">
          ₦10K online registration · ₦50K pool at venue
        </p>

        <Link
          href="/tournament"
          onClick={dismiss}
          className="mt-4 block w-full rounded-xl bg-gradient-to-r from-brand to-[#7F77DD] py-2.5 text-center text-sm font-bold text-white transition hover:opacity-90"
        >
          Register Now — ₦10,000 →
        </Link>
      </div>
    </div>
  );
}

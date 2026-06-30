"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TOURNAMENT } from "@/lib/tournament";

const KEY = "fc26_banner_dismissed";

export default function TournamentBanner() {
  const supabase = createClient();
  const [show, setShow] = useState(false);
  const [filled, setFilled] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return; // dismissed this session
    } catch {
      // ignore
    }
    setShow(true);
    supabase.rpc("count_tournament_registrations").then(({ data }) => {
      if (typeof data === "number") setFilled(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    setShow(false);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
  }

  if (!show) return null;

  const spotsLeft =
    filled === null ? null : Math.max(0, TOURNAMENT.capacity - filled);

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-2xl border-2 border-brand p-5 text-white shadow-card"
      style={{ backgroundColor: "#0F0A2E" }}
    >
      {/* Subtle PS5 button decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <svg className="absolute right-24 top-2 opacity-20" width="34" height="34" viewBox="0 0 24 24" fill="none">
          <path d="M12 4 21 20H3z" stroke="#4FD1A5" strokeWidth="2" />
        </svg>
        <svg className="absolute right-6 bottom-1 opacity-20" width="30" height="30" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke="#F65A78" strokeWidth="2" />
        </svg>
        <svg className="absolute left-1/2 top-3 opacity-10" width="26" height="26" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="5" width="14" height="14" rx="1.5" stroke="#E06FCB" strokeWidth="2" />
        </svg>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
      >
        ✕
      </button>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="pr-6 sm:pr-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            One of many link-ups on LinkUpNaija
          </p>
          <p className="mt-0.5 text-base font-black tracking-wide">
            🎮 FC26 TOURNAMENT — ABUJA
          </p>
          <p className="mt-1 text-sm text-white/70">
            ₦2,000,000 Prize · 40 Players Only · ₦10K to register
          </p>
          {spotsLeft !== null && (
            <p className="mt-1.5 text-sm font-bold text-[#FAC775]">
              {spotsLeft > 0 ? `🔥 ${spotsLeft} spots left` : "Tournament full"}
            </p>
          )}
        </div>

        <Link
          href="/tournament"
          className="shrink-0 rounded-xl px-5 py-2.5 text-center text-sm font-bold text-[#0F0A2E] transition hover:opacity-90"
          style={{ backgroundColor: "#FAC775" }}
        >
          Register Now →
        </Link>
      </div>
    </div>
  );
}

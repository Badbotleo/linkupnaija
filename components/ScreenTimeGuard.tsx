"use client";

import { useEffect, useState } from "react";

// LinkUpNaija's goal is real-life connections — so we cap daily in-app time at
// 5 hours and gently nudge people to go meet up in person. Time is counted only
// while the tab is visible; state lives in localStorage and resets each day.

const LIMIT_SECONDS = 5 * 60 * 60;
const TICK = 15;
const SNOOZE_MS = 30 * 60 * 1000;

function todayKey() {
  return `lun_screen_${new Date().toISOString().slice(0, 10)}`;
}

export default function ScreenTimeGuard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seconds = Number(localStorage.getItem(todayKey()) || "0");

    function overLimitAndNotSnoozed() {
      if (seconds < LIMIT_SECONDS) return false;
      const snooze = Number(localStorage.getItem("lun_screen_snooze") || "0");
      return Date.now() - snooze > SNOOZE_MS;
    }

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      seconds += TICK;
      localStorage.setItem(todayKey(), String(seconds));
      if (overLimitAndNotSnoozed()) setShow(true);
    }, TICK * 1000);

    if (overLimitAndNotSnoozed()) setShow(true);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.style.overflow = show ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  if (!show) return null;

  function snooze() {
    localStorage.setItem("lun_screen_snooze", String(Date.now()));
    setShow(false);
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-6 text-center text-white"
      style={{ backgroundColor: "#1A1040" }}
    >
      <div className="max-w-md">
        <p className="text-6xl">🌱</p>
        <h2 className="mt-5 text-3xl font-extrabold">Time to touch grass</h2>
        <p className="mt-3 text-lg text-white/80">
          You&apos;ve spent 5 hours on LinkUpNaija today. The best connections
          happen in real life — go link up with your people! 💜
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <a
            href="/events"
            onClick={snooze}
            className="rounded-xl bg-[#FAC775] px-6 py-3 font-bold text-[#1A1040]"
          >
            Find a real-life link-up →
          </a>
          <button
            type="button"
            onClick={snooze}
            className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white/80 transition hover:bg-white/10"
          >
            Just 30 more minutes
          </button>
        </div>
      </div>
    </div>
  );
}

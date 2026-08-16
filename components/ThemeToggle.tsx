"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";

/**
 * Light / Dark / System.
 *
 * System is the default and what an iPhone user expects: the app follows the
 * phone, and keeps following it when the phone flips at sunset. Choosing
 * light or dark explicitly overrides that and sticks.
 *
 * The class is resolved before first paint by the script in layout.tsx, so
 * this component only handles changes — it never causes the flash.
 */
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const s = localStorage.getItem("theme") as Mode | null;
      setMode(s === "dark" || s === "light" ? s : "system");
    } catch {
      /* storage can be blocked; system is a fine default */
    }
  }, []);

  // Follow the phone while on "system". Without this listener the app only
  // matches at load and then drifts out of step the moment iOS switches.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle("dark", mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);

  function choose(next: Mode) {
    setMode(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    const dark =
      next === "dark" ||
      (next === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }

  // Cycles rather than opening a menu: three states is few enough to tap
  // through, and a menu for three options is a menu nobody opens.
  const next: Mode =
    mode === "system" ? "light" : mode === "light" ? "dark" : "system";
  const label =
    mode === "system" ? "Following your phone" : mode === "dark" ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={`Theme: ${label}. Tap for ${next}.`}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
    >
      {/* Neutral until mounted, or the server and client disagree. */}
      {!mounted ? (
        <MoonIcon />
      ) : mode === "system" ? (
        <SystemIcon />
      ) : mode === "dark" ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** A phone, because "system" means "whatever this device is doing". */
function SystemIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

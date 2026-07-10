"use client";

import { useEffect, useState } from "react";

const KEY = "install_banner_dismissed_at";
const RESHOW_AFTER_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Mobile "download the app" banner. On Android/Chrome it triggers the native
// PWA install prompt; on iOS Safari (no install API) it shows Add-to-Home-
// Screen instructions. Hidden once installed, inside Telegram, and on desktop.
export default function InstallAppBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    try {
      // Already running as an installed app?
      if (
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone
      )
        return;
      // Inside the Telegram Mini App — nothing to install.
      if (
        sessionStorage.getItem("tg_mini_app") ||
        window.location.hash.includes("tgWebApp")
      )
        return;
      const dismissedAt = Number(localStorage.getItem(KEY) || 0);
      if (Date.now() - dismissedAt < RESHOW_AFTER_DAYS * 86_400_000) return;
    } catch {
      // storage unavailable — fail open
    }

    // Android/Chrome: the browser tells us the site is installable.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari never fires beforeinstallprompt — show instructions instead.
    const ua = window.navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) {
      setIsIos(true);
      const t = setTimeout(() => setShow(true), 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setShow(false);
  }

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
    // bottom-36 clears both the bottom nav and the floating chat bubble.
    <div className="fixed bottom-36 left-3 right-3 z-40 lg:hidden">
      <div className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#1A1040]">
        {/* App icon */}
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black text-white"
          style={{ background: "linear-gradient(135deg,#534AB7,#1A1040)" }}
          aria-hidden
        >
          L
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            Get the LinkUpNaija app
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-300">
            {isIos
              ? "Tap Share ⬆ then “Add to Home Screen”"
              : "Fast, full-screen — right from your home screen"}
          </p>
        </div>
        {!isIos && (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install banner"
          className="shrink-0 text-gray-400 transition hover:text-gray-600 dark:hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

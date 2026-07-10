"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

const KEY = "install_banner_dismissed_at";
const RESHOW_AFTER_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Mobile "download the app" banner. On Android/Chrome it triggers the native
// PWA install prompt; on iPhone/iPad (Apple has no install API) it opens a
// step-by-step Add-to-Home-Screen guide. Hidden once installed, inside
// Telegram, and on desktop.
export default function InstallAppBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

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

    // iOS never fires beforeinstallprompt — offer the Add-to-Home-Screen guide.
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
    setShowIosGuide(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  if (!show) return null;

  return (
    <>
      {/* Banner — bottom-36 clears both the bottom nav and the chat bubble. */}
      <div className="fixed bottom-36 left-3 right-3 z-40 lg:hidden">
        <div className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#1A1040]">
          {/* Official app icon */}
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
            style={{ background: "linear-gradient(135deg,#262052,#1A1040)" }}
            aria-hidden
          >
            <LogoMark size={30} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Get the LinkUpNaija app
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-300">
              Fast, full-screen — right from your home screen
            </p>
          </div>
          <button
            type="button"
            onClick={isIos ? () => setShowIosGuide(true) : install}
            className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            Install
          </button>
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

      {/* iOS Add-to-Home-Screen guide */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 lg:hidden"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-6 pb-10 dark:bg-[#1A1040]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300" />
            <div className="flex items-center gap-3">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
                style={{ background: "linear-gradient(135deg,#262052,#1A1040)" }}
                aria-hidden
              >
                <LogoMark size={32} />
              </span>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">
                  Install LinkUpNaija
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-300">
                  Takes about 10 seconds
                </p>
              </div>
            </div>
            <ol className="mt-5 space-y-4">
              <IosStep n={1}>
                Tap the <strong>Share</strong> button{" "}
                <span
                  aria-hidden
                  className="mx-0.5 inline-grid h-6 w-6 place-items-center rounded-md bg-brand-50 align-middle text-sm text-brand"
                >
                  ⬆
                </span>{" "}
                in your browser toolbar
              </IosStep>
              <IosStep n={2}>
                Scroll down and tap <strong>Add to Home Screen</strong>{" "}
                <span
                  aria-hidden
                  className="mx-0.5 inline-grid h-6 w-6 place-items-center rounded-md bg-brand-50 align-middle text-sm text-brand"
                >
                  ➕
                </span>
              </IosStep>
              <IosStep n={3}>
                Tap <strong>Add</strong> — the app appears on your home screen
                🎉
              </IosStep>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="btn-primary mt-6 w-full rounded-full py-3"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function IosStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
        {n}
      </span>
      <p className="text-sm text-gray-700 dark:text-gray-200">{children}</p>
    </li>
  );
}

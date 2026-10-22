"use client";

import { useEffect } from "react";

/**
 * Keeps the app in step with the phone while it is open.
 *
 * WHY THE APP ONLY CHANGED ON REFRESH. The pre-paint script in layout.tsx
 * reads prefers-color-scheme once, on load, which is what stops the white
 * flash. The only listener for later changes lived inside ThemeToggle, and
 * ThemeToggle has not been rendered anywhere since it was pulled on 5 Aug:
 * grep finds it in two comments and nothing else. So the theme was correct
 * at load and then frozen, and an iPhone flipping to dark at sunset did
 * nothing until the page was reloaded.
 *
 * This is the listener, with no UI attached to it, so it cannot be lost
 * again by removing a button.
 *
 * AN EXPLICIT CHOICE STILL WINS. Someone who picked light or dark gets what
 * they picked, whatever the phone does. Only "system", which is the default
 * and has no localStorage entry, follows along.
 *
 * THREE TRIGGERS, NOT ONE. The media query's change event is the main one,
 * but it is not enough on a phone:
 *
 *   visibilitychange — iOS does not reliably deliver the change event to a
 *     backgrounded tab, and the usual way this happens is the phone flipping
 *     at sunset while the app sits in the background. Re-checking when it
 *     comes back is what makes that case work.
 *
 *   pageshow — a page restored from the back/forward cache does not re-run
 *     the pre-paint script, so it would come back wearing the old theme.
 *
 * Renders nothing.
 */
export default function ThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("theme");
      } catch {
        /* storage can be blocked; treat it as "system" */
      }
      if (stored === "dark" || stored === "light") {
        document.documentElement.classList.toggle("dark", stored === "dark");
        return;
      }
      document.documentElement.classList.toggle("dark", mq.matches);
    };

    apply();

    const onVisible = () => {
      if (document.visibilityState === "visible") apply();
    };

    mq.addEventListener("change", apply);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", apply);
    // Another tab changing the preference should not leave this one stale.
    window.addEventListener("storage", apply);

    return () => {
      mq.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

  return null;
}

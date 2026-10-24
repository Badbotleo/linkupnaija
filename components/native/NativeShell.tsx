"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Everything the app does that the website cannot.
 *
 * WHY IT MATTERS BEYOND POLISH. Apple's guideline 4.2 rejects an app that is
 * "simply a web site bundled as an app", and that is a fair description of a
 * Capacitor shell with nothing in it. This file is the difference between a
 * rejection and a listing, and every piece of it is a real behaviour a member
 * would notice:
 *
 *   push      registered through APNs and FCM, so a notification arrives
 *             without the member first installing a home-screen shortcut,
 *             which is the hurdle that left web push at 11 people out of 319
 *   links     a shared link-up opens in the app rather than bouncing to a
 *             browser tab
 *   back      the Android hardware back button walks the history and leaves
 *             on the last page instead of killing the app from anywhere
 *   splash    held until the first paint, so a slow connection shows the
 *             brand rather than a white rectangle
 *
 * NOTHING HAPPENS ON THE WEB. Every import is dynamic and every listener is
 * behind a native check, so the browser bundle does not grow and a desktop
 * visitor runs none of it.
 */
export default function NativeShell() {
  const router = useRouter();

  useEffect(() => {
    let cleanup: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const platform = Capacitor.getPlatform() as "ios" | "android";

      /* ---------------- status bar + splash ---------------- */
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // The site already paints its own header colour under the bar, so
        // the bar only has to agree about whether the icons are light.
        const dark = document.documentElement.classList.contains("dark");
        await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      } catch {
        /* a device without a settable status bar is not an error */
      }

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        // Hidden here rather than on a timer in the config: this runs after
        // React has mounted, which is the first moment there is something
        // behind the splash worth showing.
        await SplashScreen.hide();
      } catch {
        /* ignore */
      }

      /* ---------------- hardware back ---------------- */
      try {
        const { App } = await import("@capacitor/app");
        const sub = await App.addListener("backButton", ({ canGoBack }) => {
          // Leaving the app is only correct at the end of the history. The
          // default closes it from wherever you are, which on a deep page
          // feels like a crash.
          if (canGoBack) window.history.back();
          else App.exitApp();
        });
        cleanup.push(() => sub.remove());

        /**
         * A link-up link opens the link-up.
         *
         * Universal Links on iOS and App Links on Android deliver the full
         * https URL here. Pushing only the path keeps it inside the app; the
         * allowNavigation list in capacitor.config.ts is what stops anything
         * off our own domain getting this far.
         */
        const deep = await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const u = new URL(url);
            if (!/(^|\.)linkupnaija\.com$/.test(u.hostname)) return;
            router.push(u.pathname + u.search);
          } catch {
            /* a malformed URL is not worth a crash */
          }
        });
        cleanup.push(() => deep.remove());
      } catch {
        /* ignore */
      }

      /* ---------------- push ---------------- */
      try {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        // Only for somebody signed in. A token with no member attached is a
        // row we could never send to.
        if (!user || cancelled) return;

        const reg = await PushNotifications.addListener(
          "registration",
          async ({ value }) => {
            if (!value) return;
            // Upsert on the token, so reinstalling replaces the row rather
            // than leaving a dead one behind to be sent to forever.
            await supabase.from("native_push_tokens").upsert(
              {
                user_id: user.id,
                token: value,
                platform,
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: "token" }
            );
          }
        );
        cleanup.push(() => reg.remove());

        const err = await PushNotifications.addListener(
          "registrationError",
          (e) => console.error("push registration failed", e)
        );
        cleanup.push(() => err.remove());

        const tapped = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          ({ notification }) => {
            // Same shape the service worker already sends: { url }.
            const url = (notification.data as { url?: string })?.url;
            if (typeof url === "string" && url.startsWith("/")) router.push(url);
          }
        );
        cleanup.push(() => tapped.remove());

        // ASKED, NOT ASSUMED. A permission prompt on first launch, before
        // anybody knows what the app is, is the one most reliably denied,
        // and on iOS a denial is close to permanent. So we only register
        // when permission has already been granted, and the asking is left
        // to a moment in the product where the reason is obvious.
        const { receive } = await PushNotifications.checkPermissions();
        if (receive === "granted") await PushNotifications.register();
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      cleanup.forEach((fn) => {
        try {
          fn();
        } catch {
          /* unmounting is not a place to throw */
        }
      });
      cleanup = [];
    };
  }, [router]);

  return null;
}

/**
 * Ask for push, at a moment where the reason is on screen.
 *
 * Exported for a button to call rather than fired on launch. iOS gives one
 * chance: once somebody taps "Don't Allow" the prompt never returns and they
 * have to find it in Settings, so the ask belongs next to something like
 * "tell me when a host replies", not in front of a loading screen.
 */
export async function requestNativePush(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return false;
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { receive } = await PushNotifications.requestPermissions();
    if (receive !== "granted") return false;
    await PushNotifications.register();
    return true;
  } catch {
    return false;
  }
}

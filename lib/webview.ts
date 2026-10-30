/**
 * Are we inside our own Capacitor app?
 *
 * This matters for exactly one thing and it is not cosmetic. Google refuses
 * OAuth inside a webview with "disallowed_useragent", and our native shell IS
 * a webview. So "Continue with Google" in the installed app either dies on
 * Google's error page or escapes to the system browser, where the session
 * lands — leaving the app itself still signed out, with no sign that anything
 * worked. Somebody who installed the app to avoid the browser gets dumped
 * back into the browser and then has to do it all again.
 *
 * There is no fix that keeps the button honest: making Google work natively
 * needs the native Google Sign-In SDK and a per-platform client id, which is
 * a real piece of work and not a webview tweak. Until that exists the only
 * truthful thing to do is not offer it here.
 *
 * Checked through the global Capacitor injects rather than by importing
 * @capacitor/core, so this stays usable in plain web bundles too.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; platform?: string };
  }).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
  return cap.platform === "ios" || cap.platform === "android";
}

// Detects in-app browser webviews (Instagram, Facebook, TikTok, Telegram, …).
// Google blocks OAuth in these with "disallowed_useragent", so "Continue with
// Google" fails there — we warn the user to open in a real browser.
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const signatures = [
    "FBAN",
    "FBAV",
    "FB_IAB",
    "Instagram",
    "Line/",
    "Twitter",
    "TikTok",
    "musical_ly",
    "Snapchat",
    "Telegram",
    "WhatsApp",
    "Pinterest",
    "GSA/", // Google app in-app browser
  ];
  const matched = signatures.some((s) => ua.includes(s));
  // Generic Android WebView marker.
  const androidWebView = /Android/.test(ua) && /\bwv\b/.test(ua);
  return matched || androidWebView;
}

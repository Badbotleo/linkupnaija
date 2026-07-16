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

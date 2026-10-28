import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native shell around the LinkUpNaija web app.
 *
 * WHY A SHELL AND NOT A REWRITE. Every screen already exists, server
 * rendered, and a React Native rewrite would duplicate all of them for months
 * and give a member nothing new on the day it shipped. The reason for doing
 * this at all is distribution: the Instagram account was disabled by Meta,
 * and a Play Store and App Store listing is a channel nobody else can switch
 * off. So the shell is the cheapest route to the thing we actually lost.
 *
 * SERVER URL, NOT BUNDLED ASSETS. Next.js renders on a server, so there is no
 * static export to package. The shell loads the live site, which also means a
 * fix deploys to every installed app the moment it deploys to the web, with
 * no store review in between. The trade is that the app needs a connection to
 * do anything; AppShell handles that case rather than leaving a white screen.
 *
 * APPLE WILL NOT APPROVE A BARE WEBVIEW. Guideline 4.2 rejects apps that are
 * "simply a web site bundled as an app", and an unmodified wrapper is exactly
 * that. What earns the listing is the native behaviour layered on top: push
 * registered through APNs and FCM rather than the browser, universal and app
 * links so a shared link-up opens in the app, the hardware back button, the
 * system share sheet, and a real offline state. Those are built, not
 * decorative, and they are the argument in the review notes.
 */
const config: CapacitorConfig = {
  // Reverse-DNS, and it can never change once a listing exists: the id IS the
  // app on both stores, so a typo here is a new app rather than an update.
  appId: "com.linkupnaija.app",
  appName: "LinkUpNaija",

  // Required by the CLI even though nothing is copied from it, because the
  // app loads from `server.url`. It holds the offline fallback only.
  webDir: "capacitor-shell",

  server: {
    url: "https://www.linkupnaija.com",
    // The site is https everywhere; this forbids the webview quietly
    // downgrading, which on Android would otherwise be allowed.
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
    /**
     * Everything NOT on this list opens in the system browser instead of
     * inside the app.
     *
     * This matters for review as much as for sense: Paystack's checkout must
     * run in a real browser with its own address bar so somebody can see who
     * they are paying, and an app that swallows a payment page inside an
     * unlabelled webview is both a trust problem and a rejection risk.
     */
    allowNavigation: ["www.linkupnaija.com", "linkupnaija.com"],

    /**
     * What loads when the site cannot be reached.
     *
     * Without this the WebView falls back to Chrome's own
     * ERR_INTERNET_DISCONNECTED page, which carries Google's branding, our URL,
     * and no way back. capacitor-shell/index.html is bundled for exactly this
     * and was doing nothing until it was named here.
     */
    errorPath: "index.html",
  },

  android: {
    // Lets the webview read the device theme, which the site already follows.
    backgroundColor: "#F7F7F9",
  },

  ios: {
    backgroundColor: "#F7F7F9",
    // The site draws its own header under the status bar and handles the
    // notch through viewport-fit=cover, which layout.tsx already sets.
    contentInset: "never",
  },

  plugins: {
    SplashScreen: {
      // Short, and dismissed by the app once the first page paints rather
      // than on a timer, so a slow Nigerian connection shows the splash
      // instead of a white rectangle.
      launchAutoHide: false,
      // #121212, matching the mark's own field in app/icon.tsx. Any other
      // value puts a dark square on a slightly different dark background
      // and the seam is visible on an OLED phone.
      backgroundColor: "#121212",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    PushNotifications: {
      // The badge is the one that needs no further permission later.
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

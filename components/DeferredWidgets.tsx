"use client";

import dynamic from "next/dynamic";

// Non-critical, below-the-fold global widgets. Code-split and client-only so
// they don't add to the initial server payload or block first paint — they
// hydrate after the main content is interactive.
// Still mounted, but it no longer shows a floating bubble: the launcher only
// renders while the panel is open. It is opened from "Ask Paddy" in the menu,
// which dispatches linkup:open-chat and would have dispatched to nothing if
// this were removed outright.
const ChatWidget = dynamic(() => import("./ChatWidget"), { ssr: false });
const ActivityTicker = dynamic(() => import("./ActivityTicker"), {
  ssr: false,
});
const ScreenTimeGuard = dynamic(() => import("./ScreenTimeGuard"), {
  ssr: false,
});
const InstallAppBanner = dynamic(() => import("./InstallAppBanner"), {
  ssr: false,
});
const TelegramMiniApp = dynamic(() => import("./TelegramMiniApp"), {
  ssr: false,
});

export default function DeferredWidgets() {
  return (
    <>
      <ActivityTicker />
      <ChatWidget />
      <ScreenTimeGuard />
      <InstallAppBanner />
      <TelegramMiniApp />
    </>
  );
}

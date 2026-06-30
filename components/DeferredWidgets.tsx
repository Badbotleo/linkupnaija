"use client";

import dynamic from "next/dynamic";

// Non-critical, below-the-fold global widgets. Code-split and client-only so
// they don't add to the initial server payload or block first paint — they
// hydrate after the main content is interactive.
const ChatWidget = dynamic(() => import("./ChatWidget"), { ssr: false });
const ActivityTicker = dynamic(() => import("./ActivityTicker"), {
  ssr: false,
});

export default function DeferredWidgets() {
  return (
    <>
      <ActivityTicker />
      <ChatWidget />
    </>
  );
}

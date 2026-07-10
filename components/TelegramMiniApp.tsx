"use client";

import { useEffect } from "react";

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

// Bootstraps the site as a Telegram Mini App. Telegram launches the Mini App
// URL with #tgWebAppData=… in the hash — we detect that (or a previous visit
// this session), load Telegram's SDK, and signal ready/expand so the app
// fills the Telegram window. Renders nothing outside Telegram.
export default function TelegramMiniApp() {
  useEffect(() => {
    let inTelegram = false;
    try {
      inTelegram =
        window.location.hash.includes("tgWebApp") ||
        "TelegramWebviewProxy" in window ||
        !!sessionStorage.getItem("tg_mini_app");
    } catch {
      // ignore
    }
    if (!inTelegram) return;

    try {
      // Survives client-side navigation after Telegram's hash is gone.
      sessionStorage.setItem("tg_mini_app", "1");
    } catch {
      // ignore
    }

    const init = () => {
      const wa = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } })
        .Telegram?.WebApp;
      if (!wa) return;
      wa.ready();
      wa.expand();
      wa.setHeaderColor?.("#1A1040");
    };

    if (document.getElementById("tg-webapp-sdk")) {
      init();
      return;
    }
    const script = document.createElement("script");
    script.id = "tg-webapp-sdk";
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
  }, []);

  return null;
}

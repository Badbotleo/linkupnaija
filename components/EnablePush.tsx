"use client";

import { useEffect, useState } from "react";
import { enablePush, pushStatus } from "@/lib/push";
import { toast } from "@/lib/toast";

// Opt-in card for browser push notifications. Shows only when relevant.
export default function EnablePush() {
  const [status, setStatus] = useState<
    "unsupported" | "granted" | "denied" | "default" | "loading"
  >("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushStatus().then(setStatus);
  }, []);

  async function turnOn() {
    setBusy(true);
    const ok = await enablePush();
    setBusy(false);
    if (ok) {
      setStatus("granted");
      toast.success("Push notifications on 🔔");
    } else {
      const s = await pushStatus();
      setStatus(s);
      if (s === "denied")
        toast.error("Notifications are blocked in your browser settings.");
    }
  }

  if (status === "loading" || status === "unsupported" || status === "granted")
    return null;

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand-50 px-5 py-4 sm:flex-row sm:items-center">
      <span className="text-2xl" aria-hidden>
        🔔
      </span>
      <div className="flex-1">
        <p className="font-bold text-gray-900">Never miss a link-up</p>
        <p className="text-sm text-gray-600">
          {status === "denied"
            ? "Notifications are blocked. Enable them for LinkUpNaija in your browser settings."
            : "Get a ping when your event is starting, a request is approved, or something new drops near you."}
        </p>
      </div>
      {status !== "denied" && (
        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          className="btn-primary shrink-0"
        >
          {busy ? "Enabling…" : "Turn on"}
        </button>
      )}
    </div>
  );
}

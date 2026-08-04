"use client";

import { useEffect, useState } from "react";
import QrModalButton from "./qr/QrModalButton";

export default function ShareButtons({
  title,
  dateLabel,
  location,
}: {
  title: string;
  dateLabel: string;
  location: string;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Resolve the absolute event URL on the client to avoid SSR mismatch.
  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  // The share sheet carries this into whichever app they pick, so one
  // message serves all of them instead of a per-network string each.
  const shareText = `Hey! Check out this event on LinkUpNaija: ${title} on ${dateLabel} at ${location}.`;

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older / non-secure contexts.
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently ignore — clipboard not available.
    }
  }

  async function share() {
    // navigator.share needs a user gesture and HTTPS; where it's missing or
    // the person cancels, copying is the sensible fallback.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
        return;
      } catch {
        // cancelled, or the sheet refused — fall through to copy
      }
    }
    copyLink();
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Share this event
      </p>
      <div className="mt-3 flex items-center gap-2">
        {/* One share button, not four. The native sheet already lists
            WhatsApp, X, Facebook and everything else the person actually has
            installed — hardcoding three of them is a website's idea of
            sharing. Falls back to copying the link where there's no sheet. */}
        <button
          type="button"
          onClick={share}
          aria-label="Share this event"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-3.5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          {copied ? <CheckIcon /> : <ShareIcon />}
          {copied ? "Link copied" : "Share"}
        </button>

        {url && (
          <QrModalButton
            value={url}
            copyValue={url}
            caption="Scan to view this event"
            fileName="linkupnaija-event"
            title="Share via QR"
            buttonLabel="QR code"
          />
        )}
      </div>
    </div>
  );
}

/* --- Icons (16px) --- */

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 16V4M8 8l4-4 4 4M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}





function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

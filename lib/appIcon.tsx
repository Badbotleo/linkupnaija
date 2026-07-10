import { ImageResponse } from "next/og";

// Brand app-icon tile, rendered at any size via next/og — the official
// LinkUpNaija pin-mark (three people in a purple emblem) on a navy field.
// The mark stays inside the centre ~65% so the same PNG works as a
// "maskable" icon (Android crops to circles/squircles).
export function appIcon(size: number) {
  const mark = size * 0.68;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #262052 0%, #1A1040 100%)",
        }}
      >
        {/* Official logo mark — keep in sync with components/Logo.tsx */}
        <svg width={mark} height={mark} viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" fill="#534AB7" />
          <circle cx="24" cy="24" r="16.5" fill="#3C3489" />
          <circle cx="24" cy="16.5" r="4" fill="#AFA9EC" />
          <path d="M16.5 30c0-4.4 3.4-7.5 7.5-7.5s7.5 3.1 7.5 7.5z" fill="#AFA9EC" />
          <circle cx="14.5" cy="23" r="3.3" fill="#FFFFFF" />
          <path d="M8.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z" fill="#FFFFFF" />
          <circle cx="33.5" cy="23" r="3.3" fill="#FFFFFF" />
          <path d="M27.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z" fill="#FFFFFF" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}

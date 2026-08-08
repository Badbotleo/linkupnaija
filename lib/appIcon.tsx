import { MARK_SHAPES } from "./logo-svg";
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
          <g dangerouslySetInnerHTML={{ __html: MARK_SHAPES }} />
          <path d="M8.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z" fill="#FFFFFF" />
          <circle cx="33.5" cy="23" r="3.3" fill="#FFFFFF" />
          <path d="M27.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z" fill="#FFFFFF" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}

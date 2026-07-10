import { ImageResponse } from "next/og";

// Brand app-icon tile, rendered at any size via next/og.
// Content stays inside the centre ~60% so the same PNG works as a
// "maskable" icon (Android crops to circles/squircles).
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #534AB7 0%, #1A1040 100%)",
        }}
      >
        <div
          style={{
            width: size * 0.56,
            height: size * 0.56,
            borderRadius: size * 0.14,
            background: "white",
            color: "#534AB7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.4,
            fontWeight: 900,
            fontFamily: "sans-serif",
          }}
        >
          L
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}

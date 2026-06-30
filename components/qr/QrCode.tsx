"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { QR_BRAND, QR_LOGO_SRC } from "@/lib/qr";

export default function QrCode({
  value,
  caption,
  fileName = "linkupnaija-qr",
  fgColor = QR_BRAND,
  bgColor = "#ffffff",
  displaySize = 240,
  exportSize = 1000,
  withLogo = true,
  copyValue,
  dark = false,
}: {
  value: string;
  caption?: string;
  fileName?: string;
  fgColor?: string;
  bgColor?: string;
  displaySize?: number;
  /** Intrinsic canvas size — also the PNG export resolution. */
  exportSize?: number;
  withLogo?: boolean;
  /** If provided, shows a "Copy Link" button that copies this string. */
  copyValue?: string;
  /** Dark surroundings (e.g. tournament) — lightens the caption text. */
  dark?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Logo ~20% of the QR width → ~4% of its area. With level "H" (30% error
  // correction) this stays reliably scannable.
  const logoPx = Math.round(exportSize * 0.2);

  function download() {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function copy() {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div
        ref={wrapRef}
        className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
        style={{ lineHeight: 0 }}
      >
        <QRCodeCanvas
          value={value}
          size={exportSize}
          fgColor={fgColor}
          bgColor={bgColor}
          level="H"
          marginSize={2}
          imageSettings={
            withLogo
              ? {
                  src: QR_LOGO_SRC,
                  width: logoPx,
                  height: logoPx,
                  excavate: true,
                }
              : undefined
          }
          style={{ width: displaySize, height: displaySize }}
        />
      </div>

      {caption && (
        <p
          className={`mt-3 text-sm font-medium ${
            dark ? "text-white/80" : "text-gray-600"
          }`}
        >
          {caption}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={download} className="btn-primary">
          Download QR Code
        </button>
        {copyValue && (
          <button type="button" onClick={copy} className="btn-outline">
            {copied ? "Copied!" : "Copy Link"}
          </button>
        )}
      </div>
    </div>
  );
}

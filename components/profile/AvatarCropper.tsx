"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Choose the crop, the way X does.
 *
 * The avatar was whatever came off the camera roll, squeezed into a circle by
 * object-cover. That centre-crops: a full-length photo becomes somebody's
 * midriff, a group shot becomes a stranger's shoulder, and the member has no
 * say. The one picture that represents somebody on a platform where a host
 * decides whether to let them in was the one thing they could not frame.
 *
 * Written rather than installed. A cropper is a transform and a canvas, and
 * the dependency would be larger than this file.
 *
 * Drag to move, pinch or slide to zoom. The offsets are clamped so the circle
 * can never show emptiness, which also means there is no wrong result to
 * apologise for: whatever is under the ring is what gets saved.
 */

const VIEW = 300; // the square the image is framed inside, in CSS pixels
const OUT = 512; // what actually gets uploaded

export default function AvatarCropper({
  src,
  onCancel,
  onApply,
}: {
  src: string;
  onCancel: () => void;
  /** A square JPEG of the visible circle. */
  onApply: (file: File) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  const drag = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const points = useRef<Map<number, { x: number; y: number }>>(new Map());

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => setImg(el);
    el.src = src;
  }, [src]);

  // Escape closes, and the page behind must not scroll while this is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  // Cover, not contain: the circle must never show a gap.
  const base = img ? Math.max(VIEW / img.width, VIEW / img.height) : 1;
  const eff = base * zoom;

  /** How far the image can move before an edge would enter the circle. */
  const clamp = useCallback(
    (next: { x: number; y: number }) => {
      if (!img) return next;
      const maxX = Math.max(0, (img.width * eff - VIEW) / 2);
      const maxY = Math.max(0, (img.height * eff - VIEW) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [img, eff]
  );

  useEffect(() => setOff((o) => clamp(o)), [clamp]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.current.size === 1) {
      drag.current = { x: e.clientX - off.x, y: e.clientY - off.y };
    } else if (points.current.size === 2) {
      const [a, b] = Array.from(points.current.values());
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!points.current.has(e.pointerId)) return;
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (points.current.size >= 2 && pinch.current) {
      const [a, b] = Array.from(points.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const next = (pinch.current.zoom * d) / (pinch.current.dist || 1);
      setZoom(Math.min(4, Math.max(1, next)));
      return;
    }
    if (drag.current) {
      setOff(clamp({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    points.current.delete(e.pointerId);
    if (points.current.size < 2) pinch.current = null;
    if (points.current.size === 0) drag.current = null;
  }

  async function apply() {
    if (!img) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // The same transform the preview is showing, scaled up to the export
      // size. Anything else and what they framed is not what they get.
      const r = OUT / VIEW;
      const dw = img.width * eff * r;
      const dh = img.height * eff * r;
      const dx = (OUT - dw) / 2 + off.x * r;
      const dy = (OUT - dh) / 2 + off.y * r;

      // White underneath: a transparent PNG cropped to JPEG would go black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(img, dx, dy, dw, dh);

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.9)
      );
      if (!blob) return;
      onApply(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-2 text-[15px] font-semibold text-white/80 transition hover:text-white"
        >
          Cancel
        </button>
        <p className="text-[15px] font-bold text-white">Move and scale</p>
        <button
          type="button"
          onClick={apply}
          disabled={!img || busy}
          className="rounded-full bg-brand px-4 py-2 text-[15px] font-extrabold text-white transition disabled:opacity-50"
        >
          {busy ? "…" : "Use photo"}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-10">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ width: VIEW, height: VIEW, touchAction: "none" }}
          className="relative overflow-hidden rounded-full ring-2 ring-white/70"
        >
          {img && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: img.width * eff,
                height: img.height * eff,
                transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))`,
                maxWidth: "none",
              }}
            />
          )}
        </div>

        <div className="flex w-full max-w-[300px] items-center gap-3">
          <span className="text-xs font-bold text-white/50">-</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            aria-label="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-brand"
          />
          <span className="text-xs font-bold text-white/50">+</span>
        </div>

        <p className="text-center text-[13px] text-white/50">
          Drag to move. Pinch or use the slider to zoom.
        </p>
      </div>
    </div>,
    document.body
  );
}

"use client";

import { useRef, useState } from "react";
import LineIcon from "@/components/ui/LineIcon";
import { toast } from "@/lib/toast";
import { probeMedia } from "@/lib/video-poster";

/** What the picker hands back once a file has been checked, before upload. */
export interface PickedFile {
  file: File;
  type: "image" | "video";
  /** Local object URL, for the strip. Revoked on remove. */
  preview: string;
}

/**
 * Pick several photos and clips for one post, in order.
 *
 * DECODES BEFORE ACCEPTING, like the recap uploader does. Three of the
 * thirteen recaps on this platform are HEIC and do not render in Chrome at
 * all, and a fourth is 4K and drops its video track on a mid-range Android,
 * which is heard as sound with a black screen. Both got through because the
 * old check asked canPlayType about a MIME string rather than asking the
 * file whether it decodes. This asks the file.
 *
 * ORDER IS THE POST. The strip is the running order and the first item is
 * the cover, so removing one has to preserve the rest rather than resorting.
 *
 * Nothing uploads here. The picker validates and previews; the surface that
 * owns the post does the uploading, because the bucket, the path convention
 * and the row shape differ between a circle post, a gallery photo and a
 * recap.
 */
export default function MediaPicker({
  value,
  onChange,
  max = 10,
  maxBytes = 25 * 1024 * 1024,
  disabled = false,
  label = "Add photos or video",
}: {
  value: PickedFile[];
  onChange: (next: PickedFile[]) => void;
  max?: number;
  maxBytes?: number;
  disabled?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);

  async function take(files: File[]) {
    if (files.length === 0) return;
    const room = max - value.length;
    if (room <= 0) {
      toast.error(`That's the limit of ${max}.`);
      return;
    }
    const batch = files.slice(0, room);
    if (files.length > room) {
      toast.error(`Only the first ${room} were added. Limit is ${max}.`);
    }

    setChecking(true);
    const accepted: PickedFile[] = [];
    for (const file of batch) {
      const isVideo = file.type.startsWith("video/");
      if (!isVideo && !file.type.startsWith("image/")) {
        toast.error(`${file.name}: not a photo or a video.`);
        continue;
      }
      if (file.size > maxBytes) {
        toast.error(
          `${file.name}: over ${Math.round(maxBytes / 1024 / 1024)}MB.`
        );
        continue;
      }

      const probe = await probeMedia(file, isVideo);
      if (!probe.ok) {
        toast.error(
          isVideo
            ? `${file.name}: won't play in a normal browser. Export as MP4 (H.264).`
            : `${file.name}: won't display for most people. iPhone photos save as HEIC; export as JPEG.`
        );
        continue;
      }
      // 4K is a phone's default and most phones cannot play it back.
      if (isVideo && Math.max(probe.w, probe.h) > 2200) {
        toast.error(
          `${file.name}: ${probe.w}x${probe.h} is too big for most phones. Export at 1080p.`
        );
        continue;
      }

      accepted.push({
        file,
        type: isVideo ? "video" : "image",
        preview: URL.createObjectURL(file),
      });
    }
    setChecking(false);
    if (accepted.length > 0) onChange([...value, ...accepted]);
  }

  function remove(i: number) {
    const gone = value[i];
    if (gone) URL.revokeObjectURL(gone.preview);
    onChange(value.filter((_, n) => n !== i));
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Cleared so picking the same file twice in a row still fires.
          e.target.value = "";
          void take(files);
        }}
      />

      {value.length > 0 && (
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
          {value.map((m, i) => (
            <div
              key={m.preview}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/10"
            >
              {m.type === "video" ? (
                <>
                  <video
                    src={m.preview}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-white">
                    <LineIcon name="video" size={11} />
                  </span>
                </>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={m.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}

              {/* The first one is the cover, so it says so. */}
              {i === 0 && value.length > 1 && (
                <span className="absolute left-1 top-1 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                  Cover
                </span>
              )}

              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove"
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-white transition hover:bg-black"
              >
                <LineIcon name="x" size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || checking || value.length >= max}
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-brand/40 hover:text-brand disabled:opacity-50 dark:border-white/15 dark:text-white"
      >
        <LineIcon name="camera" size={16} />
        {checking
          ? "Checking…"
          : value.length === 0
            ? label
            : `Add more (${value.length}/${max})`}
      </button>
    </div>
  );
}

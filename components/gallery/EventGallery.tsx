"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { toast } from "@/lib/toast";
import Avatar from "../Avatar";
import type { EventPhoto } from "@/lib/types";

const MAX_PER_UPLOAD = 10;

interface Staged {
  file: File;
  caption: string;
  preview: string;
}

export default function EventGallery({
  eventId,
  eventTitle,
  canUpload,
  isHost,
  currentUser,
  initialPhotos,
}: {
  eventId: string;
  eventTitle: string;
  canUpload: boolean;
  isHost: boolean;
  currentUser: { id: string; name: string | null; avatar_url: string | null } | null;
  initialPhotos: EventPhoto[];
}) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<EventPhoto[]>(initialPhotos);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PER_UPLOAD);
    if (files.length === 0) return;
    setStaged(
      files.map((file) => ({
        file,
        caption: "",
        preview: URL.createObjectURL(file),
      }))
    );
    e.target.value = "";
  }

  async function uploadAll() {
    if (!currentUser || staged.length === 0) return;
    setUploading(true);
    setProgress(0);
    const added: EventPhoto[] = [];

    for (let i = 0; i < staged.length; i++) {
      const { file, caption } = staged[i];
      try {
        const optimized = await compressImage(file, { maxDimension: 1600 });
        const path = `${eventId}/${currentUser.id}/${Date.now()}-${i}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("event-photos")
          .upload(path, optimized, { upsert: true, cacheControl: "3600" });
        if (upErr) throw upErr;
        const photo_url = supabase.storage
          .from("event-photos")
          .getPublicUrl(path).data.publicUrl;

        const { data: row, error: insErr } = await supabase
          .from("event_photos")
          .insert({
            event_id: eventId,
            uploader_id: currentUser.id,
            photo_url,
            caption: caption.trim() || null,
          })
          .select("id, event_id, uploader_id, photo_url, caption, created_at")
          .single();
        if (insErr) throw insErr;

        added.push({
          ...(row as Omit<EventPhoto, "uploader">),
          uploader: { name: currentUser.name, avatar_url: currentUser.avatar_url },
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? `Upload failed: ${err.message}` : "Upload failed"
        );
      }
      setProgress(Math.round(((i + 1) / staged.length) * 100));
    }

    setPhotos((prev) => [...added, ...prev]);
    setStaged([]);
    setUploading(false);
    if (added.length) toast.success(`Shared ${added.length} photo${added.length > 1 ? "s" : ""} 📸`);
  }

  async function remove(photo: EventPhoto) {
    if (!confirm("Delete this photo?")) return;
    const { error } = await supabase.from("event_photos").delete().eq("id", photo.id);
    if (error) {
      toast.error("Couldn't delete the photo.");
      return;
    }
    // Best-effort storage cleanup (path is everything after the bucket name).
    const marker = "/event-photos/";
    const idx = photo.photo_url.indexOf(marker);
    if (idx !== -1) {
      const path = photo.photo_url.slice(idx + marker.length);
      supabase.storage.from("event-photos").remove([path]).catch(() => {});
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setLightbox(null);
    toast.success("Photo deleted");
  }

  function canDelete(photo: EventPhoto) {
    return isHost || photo.uploader_id === currentUser?.id;
  }

  return (
    <div>
      {/* Upload */}
      {canUpload && (
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          {staged.length === 0 ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                onChange={onPick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="btn-primary w-full"
              >
                📸 Upload photos
              </button>
              <p className="mt-2 text-center text-xs text-gray-400">
                Up to {MAX_PER_UPLOAD} photos at a time.
              </p>
            </>
          ) : (
            <div>
              <p className="mb-3 text-sm font-semibold text-gray-900">
                {staged.length} photo{staged.length > 1 ? "s" : ""} selected — add
                a caption (optional):
              </p>
              <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                {staged.map((s, i) => (
                  <div key={i} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.preview}
                      alt=""
                      className="h-24 w-full rounded-lg object-cover"
                    />
                    <input
                      value={s.caption}
                      onChange={(e) =>
                        setStaged((prev) =>
                          prev.map((p, j) =>
                            j === i ? { ...p, caption: e.target.value } : p
                          )
                        )
                      }
                      placeholder="Caption…"
                      className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-brand focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {uploading && (
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-brand transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center text-xs text-gray-500">
                    Uploading… {progress}%
                  </p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={uploadAll}
                  disabled={uploading}
                  className="btn-primary flex-1"
                >
                  {uploading ? "Uploading…" : `Share ${staged.length} photo${staged.length > 1 ? "s" : ""}`}
                </button>
                <button
                  type="button"
                  onClick={() => setStaged([])}
                  disabled={uploading}
                  className="btn-outline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Share collage */}
      {photos.length >= 1 && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => shareCollage(photos, eventTitle)}
            className="btn-outline text-sm"
          >
            🖼️ Share event memories
          </button>
        </div>
      )}

      {/* Gallery */}
      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
          <p className="text-4xl">📸</p>
          <p className="mt-3 font-semibold text-gray-700">
            Be the first to share a memory from this event 📸
          </p>
        </div>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3">
          {photos.map((photo, i) => (
            <figure key={photo.id} className="mb-3 break-inside-avoid">
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="block w-full overflow-hidden rounded-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photo_url}
                  alt={photo.caption ?? "Event photo"}
                  loading="lazy"
                  className="w-full rounded-xl transition hover:opacity-90"
                />
              </button>
              <figcaption className="mt-1.5 flex items-center gap-2 px-0.5">
                <Avatar
                  name={photo.uploader?.name ?? null}
                  url={photo.uploader?.avatar_url ?? null}
                  size="sm"
                />
                <span className="min-w-0 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">
                    {photo.uploader?.name ?? "Member"}
                  </span>{" "}
                  · {timeAgo(photo.created_at)}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && photos[lightbox] && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          onDelete={remove}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
  onDelete,
  canDelete,
}: {
  photos: EventPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDelete: (p: EventPhoto) => void;
  canDelete: (p: EventPhoto) => boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(Math.min(photos.length - 1, index + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index - 1));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, photos.length, onClose, onIndex]);

  const photo = photos[index];
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/90"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm">
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="text-2xl">
          ✕
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {index > 0 && (
          <button
            type="button"
            onClick={() => onIndex(index - 1)}
            aria-label="Previous"
            className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl text-white hover:bg-white/25"
          >
            ‹
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.photo_url}
          alt={photo.caption ?? "Event photo"}
          className="max-h-[75vh] max-w-full rounded-lg object-contain"
        />
        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => onIndex(index + 1)}
            aria-label="Next"
            className="absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl text-white hover:bg-white/25"
          >
            ›
          </button>
        )}
      </div>

      <div
        className="p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {photo.caption && <p className="mb-2 text-center text-sm">{photo.caption}</p>}
        <div className="flex items-center justify-center gap-3 text-sm">
          <span className="text-white/70">
            {photo.uploader?.name ?? "Member"} · {timeAgo(photo.created_at)}
          </span>
          <button
            type="button"
            onClick={() => sharePhoto(photo)}
            className="rounded-lg bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25"
          >
            Share
          </button>
          {canDelete(photo) && (
            <button
              type="button"
              onClick={() => onDelete(photo)}
              className="rounded-lg bg-red-500/80 px-3 py-1.5 font-semibold hover:bg-red-500"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

async function sharePhoto(photo: EventPhoto) {
  const url = photo.photo_url;
  if (navigator.share) {
    try {
      await navigator.share({ title: "LinkUpNaija", url });
      return;
    } catch {
      /* fall through to copy */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Photo link copied 📋");
  } catch {
    toast.error("Couldn't copy the link.");
  }
}

// Build a 2×2 collage of the first 4 photos with a LinkUpNaija watermark and
// download it. Requires the storage objects to allow cross-origin reads; if the
// canvas is tainted we fall back to sharing the event link.
async function shareCollage(photos: EventPhoto[], eventTitle: string) {
  const pics = photos.slice(0, 4);
  const SIZE = 1080;
  const half = SIZE / 2;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#1A1040";
  ctx.fillRect(0, 0, SIZE, SIZE);

  const positions = [
    [0, 0],
    [half, 0],
    [0, half],
    [half, half],
  ];

  function load(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  try {
    const imgs = await Promise.all(pics.map((p) => load(p.photo_url)));
    imgs.forEach((img, i) => {
      const [x, y] = positions[i];
      // cover-fit into the half×half cell
      const scale = Math.max(half / img.width, half / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, x + (half - w) / 2, y + (half - h) / 2, w, h);
    });

    // Watermark bottom-right.
    ctx.font = "bold 34px system-ui, sans-serif";
    const label = "LinkUpNaija";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(SIZE - tw - 44, SIZE - 60, tw + 32, 44);
    ctx.fillStyle = "#FAC775";
    ctx.fillText(label, SIZE - tw - 28, SIZE - 28);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkupnaija-memories.png";
    a.click();
    toast.success("Collage downloaded — share it anywhere! 🖼️");
  } catch {
    // Tainted canvas / load failure — fall back to sharing the event link.
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Couldn't build the collage — event link copied instead.");
    } catch {
      toast.error("Couldn't create the collage.");
    }
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

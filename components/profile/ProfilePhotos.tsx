"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { toast } from "@/lib/toast";
import ImageLightbox from "@/components/ui/ImageLightbox";

interface Photo {
  id: string;
  photo_url: string;
}

export default function ProfilePhotos({
  userId,
  editable,
}: {
  userId: string;
  editable: boolean;
}) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("profile_photos")
      .select("id, photo_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPhotos((data ?? []) as Photo[]);
        setLoading(false);
      });
  }, [supabase, userId]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 10);
    if (files.length === 0) return;
    setBusy(true);
    const added: Photo[] = [];
    for (const file of files) {
      const optimized = await compressImage(file, { maxDimension: 1600 });
      const path = `${userId}/pp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, optimized, { upsert: true, cacheControl: "3600" });
      if (upErr) continue;
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { data } = await supabase
        .from("profile_photos")
        .insert({ user_id: userId, photo_url: publicUrl })
        .select("id, photo_url")
        .single();
      if (data) added.push(data as Photo);
    }
    setPhotos((prev) => [...added, ...prev]);
    setBusy(false);
    if (added.length) toast.success(`Added ${added.length} photo${added.length > 1 ? "s" : ""} 📸`);
  }

  async function remove(id: string) {
    await supabase.from("profile_photos").delete().eq("id", id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      {editable && (
        <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
          📷 {busy ? "Uploading…" : "Upload photos"}
          <input type="file" accept="image/*" multiple onChange={onPick} className="hidden" disabled={busy} />
        </label>
      )}

      {loading ? (
        /* The grid's own shape. "No photos yet" before the fetch returns is
           a profile telling you it is empty when it is not. */
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center text-sm text-gray-500">
          {editable ? "No photos yet. Upload your first!" : "No photos shared yet."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <div key={p.id} className="group relative">
              {/* Tappable. These were a bare <img> in a grid: somebody uploads
                  a picture of a night out, it is shown at a third of a phone
                  width, and there is no way to see it properly. The same gap
                  as the partner posters, and the same fix. */}
              <ImageLightbox
                src={p.photo_url}
                alt="Profile photo"
                className="aspect-square w-full rounded-lg object-cover"
                triggerClassName="block w-full cursor-zoom-in transition-transform duration-150 active:scale-[0.97]"
              />
              {editable && (
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label="Delete photo"
                  /* z-10 so it stays above the lightbox trigger it now sits
                     on top of, or deleting a photo would open it instead. */
                  className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

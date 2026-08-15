"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { isRealText } from "@/lib/content-guards";
import LineIcon from "../ui/LineIcon";

interface Row {
  id: string;
  title: string;
  place: string | null;
  category: string;
  state: string | null;
  seed_title: string | null;
  media_url: string | null;
  media_type: "image" | "video";
  credit: string | null;
  credit_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const BLANK: Omit<Row, "id"> = {
  title: "",
  place: "",
  category: EVENT_CATEGORIES[0],
  state: "",
  seed_title: "",
  media_url: "",
  media_type: "image",
  credit: "",
  credit_url: "",
  sort_order: 0,
  is_active: true,
};

const field =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none";

/** Curates the "Things to do this week" shelf on both home pages. */
export default function AdminThingsToDo() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<(Omit<Row, "id"> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("things_to_do")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(
        /things_to_do/.test(error.message)
          ? "Run supabase/migration-things-to-do.sql first."
          : error.message
      );
      return;
    }
    setRows((data ?? []) as Row[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(file: File) {
    // Type comes from the file itself, not the extension — an admin renaming
    // a .mov to .mp4 would otherwise store the wrong content type and the
    // card would render a broken player.
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) {
      toast.error("Pick an image or a video.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Keep it under 25MB — this autoplays on the home page.");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("things-to-do")
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
        // A year. Without this Supabase defaults to max-age=3600, so every
        // visitor re-downloaded the whole shelf hourly — 41MB of video in
        // this bucket alone. The path carries a timestamp and a random
        // suffix, so the bytes behind a URL never change and there is
        // nothing to invalidate.
        cacheControl: "31536000",
      });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("things-to-do").getPublicUrl(path);
    setEditing((e) =>
      e
        ? { ...e, media_url: data.publicUrl, media_type: isVideo ? "video" : "image" }
        : e
    );
    toast.success(isVideo ? "Video uploaded" : "Image uploaded");
  }

  async function save() {
    if (!editing || saving) return;
    // A blank title is a real choice here, not a mistake: most of these
    // uploads are videos with the description already burned into the frame,
    // and a caption drawn on top collides with it. So an empty title means
    // "no caption" and the card renders the media clean. It needs a category
    // either way — that's what seeds the host form behind the card.
    if (!editing.category) {
      toast.error("Pick a category — that's what the Host it button uses.");
      return;
    }
    const title = isRealText(editing.title) ? editing.title.trim() : "";
    setSaving(true);
    const payload = {
      title,
      // "." is not a place, and it renders under the title on the card.
      place: isRealText(editing.place) ? editing.place!.trim() : null,
      category: editing.category,
      state: editing.state || null,
      // Always a real string — with no caption this is what the host form
      // opens with, so it falls back to the category.
      seed_title: isRealText(editing.seed_title)
        ? editing.seed_title!.trim()
        : title || editing.category,
      media_url: editing.media_url?.trim() || null,
      media_type: editing.media_type,
      credit: editing.credit?.trim() || null,
      credit_url: editing.credit_url?.trim() || null,
      sort_order: editing.sort_order,
      is_active: editing.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing.id
      ? await supabase.from("things_to_do").update(payload).eq("id", editing.id)
      : await supabase.from("things_to_do").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setEditing(null);
    load();
  }

  async function toggle(r: Row) {
    const { error } = await supabase
      .from("things_to_do")
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(r: Row) {
    if (!confirm(`Delete "${r.title || r.category}"?`)) return;
    const { error } = await supabase.from("things_to_do").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {rows.length} card{rows.length === 1 ? "" : "s"}. These lead the shelf
          on both home pages; below them we fall back to partner venues.
        </p>
        <button
          type="button"
          onClick={() => setEditing({ ...BLANK })}
          className="btn-primary shrink-0 rounded-full px-4 py-2 text-sm"
        >
          Add a card
        </button>
      </div>

      {/* --- editor --- */}
      {editing && (
        <div className="mb-4 space-y-2 rounded-2xl border border-brand/25 bg-brand-50/50 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Caption — leave blank if the video has its own text"
              className={field}
            />
            <input
              value={editing.place ?? ""}
              onChange={(e) => setEditing({ ...editing, place: e.target.value })}
              placeholder="Where, e.g. Jabi Recreational Park"
              className={field}
            />
            <select
              value={editing.category}
              onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              className={field}
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={editing.state ?? ""}
              onChange={(e) => setEditing({ ...editing, state: e.target.value })}
              className={field}
            >
              <option value="">All states</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={editing.seed_title ?? ""}
              onChange={(e) => setEditing({ ...editing, seed_title: e.target.value })}
              placeholder="Event title the host form opens with (defaults to the title)"
              className={field}
            />
            <input
              value={editing.credit ?? ""}
              onChange={(e) => setEditing({ ...editing, credit: e.target.value })}
              placeholder="Credit, e.g. 📷 @photographer or Jabi Lake Mall"
              className={field}
            />
            <input
              value={editing.credit_url ?? ""}
              onChange={(e) => setEditing({ ...editing, credit_url: e.target.value })}
              placeholder="Credit link (optional)"
              className={field}
            />
            <input
              type="number"
              value={editing.sort_order}
              onChange={(e) =>
                setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })
              }
              placeholder="Sort order (lower shows first)"
              className={field}
            />
          </div>

          {/* --- media --- */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-brand disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload image or video"}
            </button>
            <input
              value={editing.media_url ?? ""}
              onChange={(e) => setEditing({ ...editing, media_url: e.target.value })}
              placeholder="…or paste a media URL"
              className={`${field} flex-1 min-w-[200px]`}
            />
            <select
              value={editing.media_type}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  media_type: e.target.value as "image" | "video",
                })
              }
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>

          {editing.media_url && (
            <div className="h-40 w-64 overflow-hidden rounded-xl bg-gray-100">
              {editing.media_type === "video" ? (
                <video
                  src={editing.media_url}
                  muted
                  loop
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={editing.media_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={editing.is_active}
              onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
            />
            Live on the home pages
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary rounded-full px-5 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* --- list --- */}
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-card"
          >
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {r.media_url ? (
                r.media_type === "video" ? (
                  <video src={r.media_url} muted className="h-full w-full object-cover" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={r.media_url} alt="" className="h-full w-full object-cover" />
                )
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-gray-900">
                {r.title}
                {r.media_type === "video" && (
                  <span className="ml-2 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                    Video
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-gray-500">
                {[r.place, r.category, r.state ?? "All states", r.credit]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(r)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                r.is_active
                  ? "bg-naija-100 text-naija-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {r.is_active ? "Live" : "Hidden"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(r)}
              className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => remove(r)}
              aria-label={`Delete ${r.title}`}
              className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <LineIcon name="trash" size={15} />
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            No curated cards yet — the shelf is showing partner venues and
            evergreen ideas.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NIGERIAN_STATES } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { isRealText } from "@/lib/content-guards";
import LineIcon from "../ui/LineIcon";

/**
 * Curates "This actually happened" — recap footage from past events.
 *
 * Deliberately mirrors AdminThingsToDo, including its lesson: a blank title is
 * a legitimate choice, because most of these clips have their description
 * burned into the frame and a caption drawn on top collides with it. Nothing
 * here forces one.
 */

interface Row {
  id: string;
  event_id: string | null;
  title: string | null;
  media_url: string | null;
  media_type: "video" | "image";
  state: string | null;
  credit: string | null;
  sort_order: number;
  is_active: boolean;
  event?: { title: string; date: string } | null;
}

interface PastEvent {
  id: string;
  title: string;
  date: string;
  state: string | null;
}

const BLANK: Omit<Row, "id"> = {
  event_id: null,
  title: "",
  media_url: "",
  media_type: "video",
  state: "",
  credit: "",
  sort_order: 0,
  is_active: true,
};

const field =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none";

export default function AdminRecaps() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [pastEvents, setPastEvents] = useState<PastEvent[]>([]);
  const [editing, setEditing] = useState<
    (Omit<Row, "id"> & { id?: string }) | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [missing, setMissing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [recaps, events] = await Promise.all([
      supabase
        .from("event_recaps")
        .select("*, event:events(title, date)")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("events")
        .select("id, title, date, state")
        .lt("date", today)
        .order("date", { ascending: false })
        .limit(80),
    ]);

    if (recaps.error) {
      // Told plainly rather than shown as an empty list — "no recaps yet" and
      // "the table doesn't exist" look identical otherwise.
      if (/event_recaps/.test(recaps.error.message)) setMissing(true);
      else toast.error(recaps.error.message);
      return;
    }
    setMissing(false);
    setRows((recaps.data ?? []) as Row[]);
    setPastEvents((events.data ?? []) as PastEvent[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(file: File) {
    // Type from the file itself, not the extension — renaming a .mov to .mp4
    // would otherwise store the wrong content type and break the player.
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) {
      toast.error("Pick a video or an image.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Keep it under 25MB — this autoplays on the home page.");
      return;
    }

    setUploading(true);
    const ext =
      file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("event-recaps")
      .upload(path, file, { contentType: file.type, upsert: true });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("event-recaps").getPublicUrl(path);
    setEditing((e) =>
      e
        ? {
            ...e,
            media_url: data.publicUrl,
            media_type: isVideo ? "video" : "image",
          }
        : e
    );
    toast.success(isVideo ? "Video uploaded" : "Image uploaded");
  }

  async function save() {
    if (!editing || saving) return;
    if (!isRealText(editing.media_url, 8)) {
      toast.error("Upload a video or image first.");
      return;
    }
    setSaving(true);
    // Inherit the state from the linked event, so the reel can order by
    // proximity without anyone having to set it twice.
    const linked = pastEvents.find((e) => e.id === editing.event_id);
    const payload = {
      event_id: editing.event_id || null,
      title: isRealText(editing.title) ? editing.title!.trim() : null,
      media_url: editing.media_url!.trim(),
      media_type: editing.media_type,
      state: editing.state || linked?.state || null,
      credit: isRealText(editing.credit) ? editing.credit!.trim() : null,
      sort_order: editing.sort_order,
      is_active: editing.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing.id
      ? await supabase.from("event_recaps").update(payload).eq("id", editing.id)
      : await supabase.from("event_recaps").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    load();
  }

  async function toggle(r: Row) {
    const { error } = await supabase
      .from("event_recaps")
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(r: Row) {
    if (!confirm(`Delete this recap${r.title ? ` "${r.title}"` : ""}?`)) return;
    const { error } = await supabase
      .from("event_recaps")
      .delete()
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  if (missing) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Run <code className="font-bold">supabase/migration-event-recaps.sql</code>{" "}
        first — it creates the table and the public storage bucket this needs.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {rows.length} recap{rows.length === 1 ? "" : "s"}. These show publicly
          on the home page — the proof that events here actually happen.
        </p>
        <button
          type="button"
          onClick={() => setEditing({ ...BLANK })}
          className="btn-primary shrink-0 rounded-full px-4 py-2 text-sm"
        >
          Add a recap
        </button>
      </div>

      {editing && (
        <div className="mb-4 space-y-2 rounded-2xl border border-brand/25 bg-brand-50/50 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              value={editing.event_id ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, event_id: e.target.value || null })
              }
              className={field}
            >
              <option value="">Not linked to an event</option>
              {pastEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.date} · {e.title.slice(0, 48)}
                </option>
              ))}
            </select>
            <input
              value={editing.title ?? ""}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Caption — leave blank if the clip has its own text"
              className={field}
            />
            <select
              value={editing.state ?? ""}
              onChange={(e) => setEditing({ ...editing, state: e.target.value })}
              className={field}
            >
              <option value="">State (from the event if blank)</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={editing.credit ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, credit: e.target.value })
              }
              placeholder="Credit, e.g. 🎬 @videographer"
              className={field}
            />
            <input
              type="number"
              value={editing.sort_order}
              onChange={(e) =>
                setEditing({ ...editing, sort_order: Number(e.target.value) })
              }
              placeholder="Sort order (lower shows first)"
              className={field}
            />
            <input
              value={editing.media_url ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, media_url: e.target.value })
              }
              placeholder="…or paste a media URL"
              className={field}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="video/*,image/*"
              hidden
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
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
            >
              <LineIcon name="video" size={14} />
              {uploading ? "Uploading…" : "Upload video or photo"}
            </button>
            <label className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) =>
                  setEditing({ ...editing, is_active: e.target.checked })
                }
              />
              Live
            </label>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-full px-4 py-2 text-sm font-bold text-gray-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary rounded-full px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          {editing.media_url && (
            <div className="max-w-[220px] overflow-hidden rounded-xl">
              {editing.media_type === "video" ? (
                <video
                  src={editing.media_url}
                  muted
                  loop
                  autoPlay
                  playsInline
                  className="h-[180px] w-full object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={editing.media_url}
                  alt=""
                  className="h-[180px] w-full object-cover"
                />
              )}
            </div>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
              {r.media_url &&
                (r.media_type === "video" ? (
                  <video
                    src={r.media_url}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.media_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">
                {r.title || (
                  <span className="font-medium text-gray-400">No caption</span>
                )}
              </p>
              <p className="truncate text-xs text-gray-500">
                {r.event
                  ? `${r.event.title} · ${r.event.date}`
                  : "Not linked to an event"}
                {r.state ? ` · ${r.state}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(r)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                r.is_active
                  ? "bg-naija-50 text-naija-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {r.is_active ? "Live" : "Hidden"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(r)}
              className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-brand"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => remove(r)}
              className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-red-600"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

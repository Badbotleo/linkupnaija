"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NIGERIAN_STATES } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { isRealText } from "@/lib/content-guards";
import LineIcon from "../ui/LineIcon";

/**
 * Partner pages, managed here instead of in the SQL editor.
 *
 * Every image on DEFCON's page went in by hand-editing a row, which is how
 * the literal string "PASTE_URL" ended up rendering as a broken image on a
 * live partner's page. Uploading a file and having the URL written for you
 * removes the step that went wrong.
 *
 * Posters take photos AND videos, several at a time, because a partner turns
 * up with a folder rather than one file.
 */

interface Row {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  collab_blurb: string | null;
  logo_url: string | null;
  cover_url: string | null;
  poster_urls: string[] | null;
  brand_color: string | null;
  accent_color: string | null;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
  state: string | null;
  is_collab: boolean;
  collab_until: string | null;
  is_active: boolean;
  sort_order: number;
}

const BLANK: Omit<Row, "id"> = {
  slug: "",
  name: "",
  tagline: "",
  about: "",
  collab_blurb: "",
  logo_url: null,
  cover_url: null,
  poster_urls: [],
  brand_color: "#534AB7",
  accent_color: "#FAC775",
  instagram: "",
  tiktok: "",
  website: "",
  state: "",
  is_collab: false,
  collab_until: null,
  is_active: true,
  sort_order: 0,
};

const field =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none";

const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

export default function AdminPartners() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<(Omit<Row, "id"> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [missing, setMissing] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      if (/partners|poster_urls|is_collab/.test(error.message)) setMissing(true);
      else toast.error(error.message);
      return;
    }
    setMissing(false);
    setRows((data ?? []) as Row[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  /** Upload one file to partner-assets. Returns its public URL, or null. */
  async function uploadOne(file: File): Promise<string | null> {
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) {
      toast.error(`${file.name}: not an image or video — skipped.`);
      return null;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error(`${file.name}: over 25MB — skipped.`);
      return null;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("partner-assets")
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
        // Paths are unique, so the bytes behind a URL never change.
        cacheControl: "31536000",
      });
    if (error) {
      toast.error(
        /Bucket not found/i.test(error.message)
          ? "Run the partner-assets bucket section of migration-partners.sql."
          : `${file.name}: ${error.message}`
      );
      return null;
    }
    return supabase.storage.from("partner-assets").getPublicUrl(path).data.publicUrl;
  }

  async function pickSingle(files: File[], key: "logo_url" | "cover_url") {
    if (!files.length) return;
    setBusy("Uploading…");
    const url = await uploadOne(files[0]);
    setBusy("");
    if (url) setEditing((e) => (e ? { ...e, [key]: url } : e));
  }

  async function pickPosters(files: File[]) {
    if (!files.length) return;
    // Sequential: a batch of flyers and clips is tens of megabytes, and
    // firing them at once is how uploads start timing out.
    const done: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      const url = await uploadOne(files[i]);
      if (url) done.push(url);
    }
    setBusy("");
    if (done.length === 0) return;
    setEditing((e) =>
      e ? { ...e, poster_urls: [...(e.poster_urls ?? []), ...done] } : e
    );
    toast.success(`${done.length} added`);
  }

  async function save() {
    if (!editing || saving) return;
    if (!isRealText(editing.name)) return toast.error("Give the partner a name.");
    const slug = editing.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      return toast.error("Slug must be lowercase letters, numbers and dashes, e.g. defcon.");

    setSaving(true);
    const payload = {
      slug,
      name: editing.name.trim(),
      tagline: isRealText(editing.tagline) ? editing.tagline!.trim() : null,
      about: isRealText(editing.about) ? editing.about!.trim() : null,
      collab_blurb: isRealText(editing.collab_blurb) ? editing.collab_blurb!.trim() : null,
      logo_url: editing.logo_url,
      cover_url: editing.cover_url,
      poster_urls: editing.poster_urls ?? [],
      brand_color: editing.brand_color,
      accent_color: editing.accent_color,
      instagram: isRealText(editing.instagram) ? editing.instagram!.trim() : null,
      tiktok: isRealText(editing.tiktok) ? editing.tiktok!.trim() : null,
      website: isRealText(editing.website) ? editing.website!.trim() : null,
      state: editing.state || null,
      is_collab: editing.is_collab,
      // A collaboration always expires. 90 days from whenever it's switched on.
      collab_until: editing.is_collab
        ? (editing.collab_until ??
           new Date(Date.now() + 90 * 86400000).toISOString())
        : null,
      is_active: editing.is_active,
      sort_order: editing.sort_order,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing.id
      ? await supabase.from("partners").update(payload).eq("id", editing.id)
      : await supabase.from("partners").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    load();
  }

  if (missing) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Run <code className="font-bold">supabase/migration-partners.sql</code>{" "}
        first — it creates the table, the poster column and the asset bucket.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {rows.length} partner{rows.length === 1 ? "" : "s"}. Each one gets a
          page at /partners/&lt;slug&gt;.
        </p>
        <button
          type="button"
          onClick={() => setEditing({ ...BLANK })}
          className="btn-primary shrink-0 rounded-full px-4 py-2 text-sm"
        >
          Add a partner
        </button>
      </div>

      {editing && (
        <div className="mb-4 space-y-3 rounded-2xl border border-brand/25 bg-brand-50/50 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Name, e.g. DEFCON" className={field} />
            <input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="Slug, e.g. defcon" className={field} />
            <input value={editing.tagline ?? ""} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} placeholder="Tagline" className={field} />
            <input value={editing.collab_blurb ?? ""} onChange={(e) => setEditing({ ...editing, collab_blurb: e.target.value })} placeholder="Collab headline, e.g. No rules. No limits. Just vibes." className={field} />
            <select value={editing.state ?? ""} onChange={(e) => setEditing({ ...editing, state: e.target.value })} className={field}>
              <option value="">No state</option>
              {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} placeholder="Sort order" className={field} />
            <input value={editing.instagram ?? ""} onChange={(e) => setEditing({ ...editing, instagram: e.target.value })} placeholder="Instagram URL" className={field} />
            <input value={editing.tiktok ?? ""} onChange={(e) => setEditing({ ...editing, tiktok: e.target.value })} placeholder="TikTok URL" className={field} />
          </div>

          <textarea value={editing.about ?? ""} onChange={(e) => setEditing({ ...editing, about: e.target.value })} rows={4} placeholder="About them" className={field} />

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              Brand
              <input type="color" value={editing.brand_color ?? "#534AB7"} onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })} className="h-9 w-12 rounded-lg border border-gray-200" />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              Accent
              <input type="color" value={editing.accent_color ?? "#FAC775"} onChange={(e) => setEditing({ ...editing, accent_color: e.target.value })} className="h-9 w-12 rounded-lg border border-gray-200" />
            </label>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={editing.is_collab} onChange={(e) => setEditing({ ...editing, is_collab: e.target.checked })} />
              Running collab
            </label>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Live
            </label>
          </div>

          {/* --- assets --- */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AssetSlot label="Logo" url={editing.logo_url} onPick={() => logoRef.current?.click()} onClear={() => setEditing({ ...editing, logo_url: null })} />
            <AssetSlot label="Cover" url={editing.cover_url} onPick={() => coverRef.current?.click()} onClear={() => setEditing({ ...editing, cover_url: null })} />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-gray-900">
                Posters &amp; clips{" "}
                <span className="font-medium text-gray-400">
                  ({editing.poster_urls?.length ?? 0})
                </span>
              </p>
              <button type="button" onClick={() => posterRef.current?.click()} disabled={!!busy} className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-50">
                {busy || "Add photos or videos"}
              </button>
            </div>
            {(editing.poster_urls?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {editing.poster_urls!.map((u, i) => (
                  <div key={u} className="relative h-24 w-20 overflow-hidden rounded-xl bg-gray-100">
                    {isVideoUrl(u) ? (
                      <video src={u} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    )}
                    <button type="button" aria-label="Remove" onClick={() => setEditing({ ...editing, poster_urls: editing.poster_urls!.filter((_, n) => n !== i) })} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
                      <LineIcon name="trash" size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { pickSingle(Array.from(e.target.files ?? []), "logo_url"); e.target.value = ""; }} />
          <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { pickSingle(Array.from(e.target.files ?? []), "cover_url"); e.target.value = ""; }} />
          <input ref={posterRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { pickPosters(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-sm font-bold text-gray-500">Cancel</button>
            <button type="button" onClick={save} disabled={saving || !!busy} className="btn-primary rounded-full px-4 py-2 text-sm disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3">
            <span className="h-10 w-10 shrink-0 rounded-lg" style={{ backgroundColor: r.brand_color ?? "#534AB7" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">{r.name}</p>
              <p className="truncate text-xs text-gray-500">
                /partners/{r.slug} · {r.poster_urls?.length ?? 0} poster
                {(r.poster_urls?.length ?? 0) === 1 ? "" : "s"}
                {r.is_collab ? " · collab on" : ""}
              </p>
            </div>
            <button type="button" onClick={() => setEditing(r)} className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-brand">Edit</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssetSlot({
  label,
  url,
  onPick,
  onClear,
}: {
  label: string;
  url: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-900">{label}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onPick} className="text-xs font-bold text-brand">
            {url ? "Replace" : "Upload"}
          </button>
          {url && (
            <button type="button" onClick={onClear} className="text-xs font-bold text-red-600">
              Clear
            </button>
          )}
        </div>
      </div>
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt="" className="mt-2 h-20 w-full rounded-lg object-contain" />
      ) : (
        <p className="mt-2 text-xs text-gray-400">Nothing set.</p>
      )}
    </div>
  );
}

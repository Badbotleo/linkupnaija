"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { toast } from "@/lib/toast";
import { NIGERIAN_STATES } from "@/lib/constants";
import { VENUE_CATEGORIES } from "@/lib/overpass";
import LineIcon from "@/components/ui/LineIcon";

export interface VenueRow {
  id: string;
  name: string;
  category: string;
  address: string | null;
  state: string | null;
  image_url: string | null;
  description: string | null;
  phone: string | null;
  website: string | null;
  price_range: string | null;
  capacity: number | null;
  is_featured: boolean;
  is_active: boolean;
}

const BLANK: Omit<VenueRow, "id"> = {
  name: "",
  category: "Restaurants",
  address: "",
  state: "",
  image_url: null,
  description: "",
  phone: "",
  website: "",
  price_range: "",
  capacity: null,
  is_featured: false,
  is_active: true,
};

export default function AdminVenues({ adminId }: { adminId: string }) {
  const supabase = createClient();
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<VenueRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("venues")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("updated_at", { ascending: false });
    setVenues((data ?? []) as VenueRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const optimized = await compressImage(file, { maxDimension: 1600 });
      const type = optimized.type || "image/jpeg";
      const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${adminId}/venue-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("event-covers")
        .upload(path, optimized, { upsert: true, cacheControl: "3600", contentType: type });
      if (error) {
        toast.error(error.message || "Upload failed.");
        return;
      }
      const url = supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl;
      setEditing((e) => ({ ...(e ?? {}), image_url: url }));
      toast.success("Photo uploaded");
    } catch {
      toast.error("Couldn't process that image.");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.name?.trim()) return;
    setSaving(true);

    const payload = {
      name: editing.name.trim(),
      category: editing.category || "Restaurants",
      address: editing.address || null,
      state: editing.state || null,
      image_url: editing.image_url || null,
      description: editing.description || null,
      phone: editing.phone || null,
      website: editing.website || null,
      price_range: editing.price_range || null,
      capacity: editing.capacity ?? null,
      is_featured: !!editing.is_featured,
      is_active: editing.is_active !== false,
    };

    const { error } = editing.id
      ? await supabase.from("venues").update(payload).eq("id", editing.id)
      : await supabase.from("venues").insert({ ...payload, created_by: adminId });

    if (error) toast.error(error.message);
    else {
      toast.success(editing.id ? "Venue updated" : "Venue onboarded");
      setEditing(null);
      await load();
    }
    setSaving(false);
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove "${name}" from onboarded venues? This can't be undone.`)) return;
    const { error } = await supabase.from("venues").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Venue removed");
      await load();
    }
  }

  async function toggle(v: VenueRow, field: "is_active" | "is_featured") {
    const { error } = await supabase
      .from("venues")
      .update({ [field]: !v[field] })
      .eq("id", v.id);
    if (error) toast.error(error.message);
    else await load();
  }

  const field = "input w-full";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold text-gray-600">
          {loading ? "Loading…" : `${venues.length} onboarded venue${venues.length === 1 ? "" : "s"}`}
        </p>
        <button
          type="button"
          onClick={() => setEditing({ ...BLANK })}
          className="btn-primary rounded-full px-4 py-2 text-sm"
        >
          + Onboard venue
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <form onSubmit={save} className="space-y-3 border-b border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900">
              {editing.id ? "Edit venue" : "Onboard a new venue"}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>

          {/* Profile picture */}
          <div className="flex items-center gap-4">
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {editing.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editing.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-gray-300">
                  <LineIcon name="image" size={24} />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="btn-outline cursor-pointer px-3 py-1.5 text-sm">
                {uploading ? "Uploading…" : editing.image_url ? "Replace photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto(f);
                  }}
                />
              </label>
              {editing.image_url && (
                <button
                  type="button"
                  onClick={() => setEditing((s) => ({ ...(s ?? {}), image_url: null }))}
                  className="btn border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={editing.name ?? ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Venue name *"
              required
              className={field}
            />
            <select
              value={editing.category ?? "Restaurants"}
              onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              className={`${field} cursor-pointer`}
            >
              {VENUE_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.key}
                </option>
              ))}
            </select>
            <input
              value={editing.address ?? ""}
              onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              placeholder="Address"
              className={field}
            />
            <select
              value={editing.state ?? ""}
              onChange={(e) => setEditing({ ...editing, state: e.target.value })}
              className={`${field} cursor-pointer`}
            >
              <option value="">State…</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={editing.phone ?? ""}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              placeholder="Phone"
              className={field}
            />
            <input
              value={editing.website ?? ""}
              onChange={(e) => setEditing({ ...editing, website: e.target.value })}
              placeholder="Website"
              className={field}
            />
            <input
              value={editing.price_range ?? ""}
              onChange={(e) => setEditing({ ...editing, price_range: e.target.value })}
              placeholder="Price range, e.g. ₦5,000 – ₦20,000"
              className={field}
            />
            <input
              type="number"
              min={0}
              value={editing.capacity ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  capacity: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Capacity"
              className={field}
            />
          </div>

          <textarea
            value={editing.description ?? ""}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            rows={3}
            placeholder="Short description shown on the venue card…"
            className={`${field} resize-y`}
          />

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={!!editing.is_featured}
                onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={editing.is_active !== false}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              Live on the site
            </label>
            <button
              type="submit"
              disabled={saving || uploading}
              className="btn-primary ml-auto px-5 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : editing.id ? "Save changes" : "Onboard venue"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {!loading && venues.length === 0 && !editing ? (
        <p className="px-6 py-10 text-center text-sm text-gray-500">
          No venues onboarded yet. Discovery falls back to OpenStreetMap until you add one.
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {venues.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-4 py-3">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {v.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-gray-300">
                    <LineIcon name="image" size={18} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-bold text-gray-900">
                  {v.name}
                  {v.is_featured && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      FEATURED
                    </span>
                  )}
                  {!v.is_active && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                      HIDDEN
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {[v.category, v.state, v.address].filter(Boolean).join(" · ")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggle(v, "is_featured")}
                  title={v.is_featured ? "Unfeature" : "Feature"}
                  className="grid h-8 w-8 place-items-center rounded-full text-gray-400 transition hover:bg-amber-50 hover:text-amber-600"
                >
                  <LineIcon name="star" size={16} filled={v.is_featured} />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(v, "is_active")}
                  title={v.is_active ? "Hide from site" : "Show on site"}
                  className="grid h-8 w-8 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <LineIcon name="eye" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(v)}
                  className="btn-outline px-3 py-1.5 text-sm"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(v.id, v.name)}
                  title="Delete"
                  className="grid h-8 w-8 place-items-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <LineIcon name="trash" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import LineIcon from "../ui/LineIcon";
import type { OnboardedVenueData } from "./OnboardedVenue";

/**
 * The venue's own page, edited by the venue.
 *
 * 223 of 257 onboarded venues have no photograph. The importer will not copy
 * Google's and we have not been to these places, so the only people who can
 * fix it are the people who work there. This is the screen where they do.
 *
 * WHAT IS NOT HERE IS THE POINT. No name, no category, no state, no map pin,
 * no "featured". Those are ours: a trigger rejects them and names the column
 * it refused, and this form simply does not offer them, so the rule is
 * visible as an absence rather than discovered as an error.
 *
 * Uploads go to venue-assets under <venue_id>/, which is not a convention but
 * the actual security boundary — the storage policy reads ownership straight
 * off the first path segment. A file saved anywhere else is rejected.
 */

const MAX_MB = 8;

export default function ManageVenue({
  venue,
}: {
  venue: OnboardedVenueData;
}) {
  const supabase = createClient();
  const [cover, setCover] = useState(venue.image_url);
  const [gallery, setGallery] = useState<string[]>(venue.gallery_urls ?? []);
  const [form, setForm] = useState({
    description: venue.description ?? "",
    phone: venue.phone ?? "",
    website: venue.website ?? "",
    opening_hours: venue.opening_hours ?? "",
    price_range: venue.price_range ?? "",
  });
  const [busy, setBusy] = useState("");
  const [saving, setSaving] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function uploadOne(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) {
      toast.error(`${file.name} is not a picture.`);
      return null;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`${file.name} is over ${MAX_MB}MB.`);
      return null;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    // The venue id first. The storage policy reads ownership off this
    // segment, so a path built any other way is refused rather than misfiled.
    const path = `${venue.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from("venue-assets")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000" });

    if (error) {
      toast.error(
        /Bucket not found/i.test(error.message)
          ? "Run migration-venue-owners.sql first."
          : /row-level security|denied/i.test(error.message)
            ? "You are not signed in as this venue's owner any more."
            : `${file.name}: ${error.message}`
      );
      return null;
    }
    return supabase.storage.from("venue-assets").getPublicUrl(path).data
      .publicUrl;
  }

  async function pick(files: File[], asCover: boolean) {
    if (!files.length) return;
    const done: string[] = [];
    // Sequential. A handful of phone photos is tens of megabytes, and firing
    // them at once is how uploads start timing out on Nigerian mobile data.
    for (let i = 0; i < files.length; i++) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      const url = await uploadOne(files[i]);
      if (url) done.push(url);
    }
    setBusy("");
    if (!done.length) return;
    if (asCover) setCover(done[0]);
    else setGallery((g) => [...g, ...done]);
    toast.success(done.length === 1 ? "Added" : `${done.length} added`);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("venues")
      .update({
        image_url: cover,
        gallery_urls: gallery,
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        opening_hours: form.opening_hours.trim() || null,
        price_range: form.price_range.trim() || null,
      })
      .eq("id", venue.id);
    setSaving(false);
    if (error) {
      // The column guard raises with the column it refused, which is worth
      // showing verbatim: it is the only message that explains the rule.
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
  }

  return (
    <div className="pb-24">
      {/* --- pictures --- */}
      <h2 className="text-[17px] font-extrabold text-gray-900 dark:text-white">
        Pictures
      </h2>
      <p className="mt-1 text-[13px] text-gray-500">
        Yours, taken at the place. The first one is what people see first.
      </p>

      <div className="mt-3">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-gray-400">
          Cover
        </span>
        {cover ? (
          <div className="relative overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="aspect-[16/10] w-full object-cover" />
            <button
              type="button"
              onClick={() => setCover(null)}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white backdrop-blur"
              aria-label="Remove cover"
            >
              <LineIcon name="trash" size={14} />
            </button>
          </div>
        ) : (
          <Picker
            label="Add a cover photo"
            onPick={(f) => pick(f, true)}
            multiple={false}
          />
        )}
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-gray-400">
          More pictures
        </span>
        <div className="grid grid-cols-3 gap-2">
          {gallery.map((url) => (
            <div key={url} className="relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => setGallery((g) => g.filter((x) => x !== url))}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white backdrop-blur"
                aria-label="Remove picture"
              >
                <LineIcon name="trash" size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <Picker label="Add pictures" onPick={(f) => pick(f, false)} multiple />
        </div>
      </div>

      {busy && (
        <p className="mt-2 text-[13px] font-semibold text-brand">{busy}</p>
      )}

      {/* --- the words --- */}
      <h2 className="mt-8 text-[17px] font-extrabold text-gray-900 dark:text-white">
        Details
      </h2>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-gray-500">
          About this place
        </span>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value.slice(0, 2000))}
          rows={4}
          placeholder="What it is, what it is good for, what to order."
          className="input resize-none"
        />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Phone"
          value={form.phone}
          onChange={(v) => set("phone", v)}
          placeholder="0801 234 5678"
        />
        <Field
          label="Website"
          value={form.website}
          onChange={(v) => set("website", v)}
          placeholder="https://…"
        />
        <Field
          label="Opening hours"
          value={form.opening_hours}
          onChange={(v) => set("opening_hours", v)}
          placeholder="Mon-Sat 10:00-22:00"
        />
        <Field
          label="Prices"
          value={form.price_range}
          onChange={(v) => set("price_range", v)}
          placeholder="₦₦ · from ₦5,000 a head"
        />
      </div>

      {/* --- what is ours --- */}
      <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] leading-snug text-gray-600 dark:bg-white/5 dark:text-white/60">
        The name, category and location are set by us. If any of them is wrong,{" "}
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("linkup:open-chat", { detail: { human: true } })
            )
          }
          className="font-bold text-brand underline"
        >
          message us
        </button>{" "}
        and we will fix it.
      </p>

      {/* --- the sticky commitment --- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 p-4 backdrop-blur dark:border-white/10 dark:bg-[#121212]/95">
        <div className="container-page flex gap-2">
          <Link
            href={`/venues/${venue.id}`}
            className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-center text-[15px] font-bold text-gray-700 dark:border-white/20 dark:text-white/80"
          >
            View page
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saving || !!busy}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Picker({
  label,
  onPick,
  multiple,
}: {
  label: string;
  onPick: (files: File[]) => void;
  multiple: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-[14px] font-bold text-gray-600 transition hover:border-brand hover:text-brand dark:border-white/20 dark:text-white/70">
      <LineIcon name="camera" size={16} />
      {label}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          onPick(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </label>
  );
}

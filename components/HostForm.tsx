"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";

export default function HostForm({ hostState }: { hostState: string | null }) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    title: "",
    category: "" as string,
    description: "",
    date: "",
    time: "",
    location: "",
    state: hostState ?? "",
    max_attendees: "",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login?redirect=/host");
      return;
    }

    // Upload the cover image first (if one was chosen).
    let coverImageUrl: string | null = null;
    if (coverFile) {
      const ext = coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("event-covers")
        .upload(path, coverFile, { upsert: true, cacheControl: "3600" });
      if (upErr) {
        setError(`Cover upload failed: ${upErr.message}`);
        setLoading(false);
        return;
      }
      coverImageUrl = supabase.storage.from("event-covers").getPublicUrl(path)
        .data.publicUrl;
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        date: form.date,
        time: form.time,
        location: form.location.trim(),
        state: form.state,
        host_id: user.id,
        max_attendees: form.max_attendees ? Number(form.max_attendees) : null,
        cover_image_url: coverImageUrl,
      })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/events/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <span className="label">Cover image</span>
        <label
          htmlFor="cover"
          className="group relative flex h-44 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition hover:border-brand/40"
        >
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt="Cover preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-center text-gray-400">
              <p className="text-3xl">🖼️</p>
              <p className="mt-1 text-sm font-medium">
                Tap to upload a cover image
              </p>
              <p className="text-xs">Optional — JPG or PNG</p>
            </div>
          )}
          {coverPreview && (
            <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
              Change
            </span>
          )}
          <input
            id="cover"
            type="file"
            accept="image/*"
            onChange={onPickCover}
            className="hidden"
          />
        </label>
      </div>

      <div>
        <label htmlFor="title" className="label">
          Event title
        </label>
        <input
          id="title"
          type="text"
          required
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Sunday Lounge & Afrobeats Night"
          className="input"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="label">
            Category
          </label>
          <select
            id="category"
            required
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="input cursor-pointer"
          >
            <option value="" disabled>
              Pick a vibe
            </option>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="state" className="label">
            State
          </label>
          <select
            id="state"
            required
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
            className="input cursor-pointer"
          >
            <option value="" disabled>
              Select state
            </option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="label">
            Date
          </label>
          <input
            id="date"
            type="date"
            required
            value={form.date}
            onChange={(e) => update("date", e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="time" className="label">
            Time
          </label>
          <input
            id="time"
            type="time"
            required
            value={form.time}
            onChange={(e) => update("time", e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="location" className="label">
          Location / venue
        </label>
        <input
          id="location"
          type="text"
          required
          value={form.location}
          onChange={(e) => update("location", e.target.value)}
          placeholder="Hard Rock Cafe, Victoria Island"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="max_attendees" className="label">
          Max attendees{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="max_attendees"
          type="number"
          min={1}
          value={form.max_attendees}
          onChange={(e) => update("max_attendees", e.target.value)}
          placeholder="Leave blank for unlimited"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea
          id="description"
          required
          rows={5}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Tell people what to expect, dress code, what to bring…"
          className="input resize-y"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Publishing…" : "Publish event 🚀"}
      </button>
    </form>
  );
}

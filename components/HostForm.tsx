"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";
import { FREQUENCY_OPTIONS, nextDates } from "@/lib/series";
import { formatEventDate } from "@/lib/format";
import type { SeriesFrequency } from "@/lib/types";

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
    price: "",
    event_type: "general" as "general" | "private",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recurring-series options.
  const [isSeries, setIsSeries] = useState(false);
  const [seriesName, setSeriesName] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");
  const [frequency, setFrequency] = useState<SeriesFrequency>("monthly");

  const seriesDates =
    isSeries && form.date ? nextDates(form.date, frequency, 3) : [];

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
      // Compress/resize before upload so we don't store multi-MB photos.
      const optimized = await compressImage(coverFile, { maxDimension: 1600 });
      const ext = optimized.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("event-covers")
        .upload(path, optimized, { upsert: true, cacheControl: "3600" });
      if (upErr) {
        setError(`Cover upload failed: ${upErr.message}`);
        setLoading(false);
        return;
      }
      coverImageUrl = supabase.storage.from("event-covers").getPublicUrl(path)
        .data.publicUrl;
    }

    const baseEvent = {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      time: form.time,
      location: form.location.trim(),
      state: form.state,
      host_id: user.id,
      max_attendees: form.max_attendees ? Number(form.max_attendees) : null,
      price: form.price ? Math.max(0, Math.round(Number(form.price))) : 0,
      event_type: form.event_type,
      cover_image_url: coverImageUrl,
    };

    // Recurring series: create the series + its first 3 events.
    if (isSeries) {
      const { data: series, error: sErr } = await supabase
        .from("event_series")
        .insert({
          host_id: user.id,
          title: (seriesName || form.title).trim(),
          description: seriesDescription.trim() || form.description.trim(),
          category: form.category,
          state: form.state,
          location: form.location.trim(),
          frequency,
          cover_image_url: coverImageUrl,
        })
        .select("id")
        .single();

      if (sErr) {
        setError(sErr.message);
        setLoading(false);
        return;
      }

      const rows = nextDates(form.date, frequency, 3).map((date) => ({
        ...baseEvent,
        date,
        series_id: series.id,
      }));
      const { error: evErr } = await supabase.from("events").insert(rows);
      if (evErr) {
        setError(evErr.message);
        setLoading(false);
        return;
      }

      router.push(`/series/${series.id}`);
      router.refresh();
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .insert({ ...baseEvent, date: form.date })
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
        <span className="label">Visibility</span>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: "general", label: "General", hint: "Visible to everyone" },
              {
                v: "private",
                label: "Private 🔒",
                hint: "Invited guests only",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, event_type: opt.v }))
              }
              className={`rounded-xl border p-3 text-left transition ${
                form.event_type === opt.v
                  ? "border-brand bg-brand-50"
                  : "border-gray-200 bg-white hover:border-brand/40"
              }`}
            >
              <span className="block text-sm font-bold text-gray-900">
                {opt.label}
              </span>
              <span className="block text-xs text-gray-500">{opt.hint}</span>
            </button>
          ))}
        </div>
        {form.event_type === "private" && (
          <p className="mt-1.5 text-xs text-gray-400">
            Private events don&apos;t appear in the public feed — share the event
            link directly with your guests.
          </p>
        )}
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

      <div className="grid gap-5 sm:grid-cols-2">
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
            placeholder="Unlimited"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="price" className="label">
            Ticket price (₦){" "}
            <span className="font-normal text-gray-400">(0 = free)</span>
          </label>
          <input
            id="price"
            type="number"
            min={0}
            step={100}
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="0"
            className="input"
          />
          <p className="mt-1 text-xs text-gray-400">
            Paid events collect payment via Paystack before a request is sent.
          </p>
        </div>
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

      {/* Recurring series */}
      <div className="rounded-xl border border-gray-200 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={isSeries}
            onChange={(e) => setIsSeries(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            <span className="block text-sm font-bold text-gray-900">
              🔄 Make this a recurring series
            </span>
            <span className="block text-xs text-gray-500">
              We&apos;ll create the first 3 events automatically based on your
              frequency.
            </span>
          </span>
        </label>

        {isSeries && (
          <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <label htmlFor="seriesName" className="label">
                Series name
              </label>
              <input
                id="seriesName"
                type="text"
                value={seriesName}
                onChange={(e) => setSeriesName(e.target.value)}
                placeholder="Monthly Abuja Book Club"
                className="input"
              />
            </div>
            <div>
              <span className="label">Frequency</span>
              <div className="grid grid-cols-3 gap-2">
                {FREQUENCY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setFrequency(o.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      frequency === o.value
                        ? "border-brand bg-brand-50 text-brand"
                        : "border-gray-200 bg-white text-gray-600 hover:border-brand/40"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="seriesDescription" className="label">
                Series description{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="seriesDescription"
                rows={3}
                value={seriesDescription}
                onChange={(e) => setSeriesDescription(e.target.value)}
                placeholder="What the series is about, who it's for…"
                className="input resize-y"
              />
            </div>
            {seriesDates.length > 0 && (
              <div className="rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand">
                <p className="font-semibold">First 3 events:</p>
                <p className="mt-0.5 text-brand/80">
                  {seriesDates.map((d) => formatEventDate(d)).join("  ·  ")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading
          ? "Publishing…"
          : isSeries
            ? "Create series 🔄"
            : "Publish event 🚀"}
      </button>
    </form>
  );
}

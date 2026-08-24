"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import Link from "next/link";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";
import { FREQUENCY_OPTIONS, nextDates } from "@/lib/series";
import { formatEventDate } from "@/lib/format";
import { validateLocation, MAX_LOCATION_LENGTH } from "@/lib/content-guards";
import { detectLeaks, LEAK_LABELS } from "@/lib/external-links";
import type { SeriesFrequency } from "@/lib/types";

export default function HostForm({
  hostState,
  prefill,
}: {
  hostState: string | null;
  /** Carried in from a "Things to do" idea, so the form opens part-done. */
  prefill?: { category?: string; location?: string; state?: string; title?: string };
}) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    title: prefill?.title ?? "",
    category: (prefill?.category ?? "") as string,
    description: "",
    date: "",
    time: "",
    location: prefill?.location ?? "",
    state: prefill?.state ?? hostState ?? "",
    max_attendees: "",
    min_attendees: "",
    end_time: "",
    auto_confirm: false,
    price: "",
    event_type: "general" as "general" | "private",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  // Extra pictures beyond the cover. Four here plus the cover is the five a
  // host is offered.
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recurring-series options.
  const [isSeries, setIsSeries] = useState(false);
  const [seriesName, setSeriesName] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");
  const [frequency, setFrequency] = useState<SeriesFrequency>("monthly");

  /**
   * Ticket types, collected before the event exists.
   *
   * They can't be written until the event has an id, so they're held here and
   * inserted straight after it. A host setting up combo packs and tables
   * shouldn't have to create the event, find it, and come back.
   */
  const [tiers, setTiers] = useState<
    { name: string; price: string; admits: string; description: string }[]
  >([]);

  // Circles the host can share this event to.
  const [myCircles, setMyCircles] = useState<{ id: string; name: string }[]>([]);
  const [postToCircle, setPostToCircle] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("circle_members")
        .select("circle:circles(id, name)")
        .eq("user_id", user.id)
        .eq("status", "active");
      setMyCircles(
        ((data ?? []) as unknown as { circle: { id: string; name: string } | null }[])
          .map((r) => r.circle)
          .filter((c): c is { id: string; name: string } => !!c)
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seriesDates =
    isSeries && form.date ? nextDates(form.date, frequency, 3) : [];

  // Typed to the field, not to string — the form gained a boolean and a
  // string-only signature would have quietly forced every caller to cast.
  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const MAX_EXTRA = 4;

  function onPickExtras(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    // Take what fits and say so, rather than silently dropping the rest.
    const room = MAX_EXTRA - extraFiles.length;
    const taken = picked.slice(0, Math.max(0, room));
    if (picked.length > taken.length) {
      setError(`Only ${MAX_EXTRA + 1} pictures per event — kept the first ${taken.length}.`);
    }
    setExtraFiles((prev) => [...prev, ...taken]);
    setExtraPreviews((prev) => [...prev, ...taken.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removeExtra(i: number) {
    URL.revokeObjectURL(extraPreviews[i]);
    setExtraFiles((prev) => prev.filter((_, n) => n !== i));
    setExtraPreviews((prev) => prev.filter((_, n) => n !== i));
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

    // Both checks run before any upload, so a rejected event doesn't leave
    // orphaned images in the bucket.

    // No phone numbers, emails or sign-up links in the description.
    //
    // Two problems, one rule. A listing that says "WhatsApp HIKE to 070…"
    // sends people off the platform before they ever make an account — 7 of
    // 53 upcoming listings did exactly that. And it publishes somebody's
    // personal mobile number to the open internet, which is a worse problem
    // and not one the person who typed it necessarily intended.
    //
    // Blocked at write time rather than stripped silently: quietly deleting
    // a host's contact details would leave them thinking buyers could reach
    // them when nobody can.
    const leaks = detectLeaks(form.description);
    if (leaks.length > 0) {
      setError(
        `Take the contact details out of your description — ${leaks
          .map((l) => LEAK_LABELS[l.kind].toLowerCase())
          .join(", ")}. People join through LinkUpNaija, and your number stays private. Put what's included and what to expect here instead.`
      );
      setLoading(false);
      return;
    }

    // A location field with no cap absorbed an entire 474-character event
    // description on one live listing, which then rendered as the venue.
    const locationError = validateLocation(form.location);
    if (locationError) {
      setError(locationError);
      setLoading(false);
      return;
    }

    // Double-submit guard. Two identical rows 15 minutes apart is what
    // produced the duplicate "Cocktails and Chow Festival 2.0" listings —
    // nobody runs the same event twice at the same place on the same day.
    const { data: clash, error: clashErr } = await supabase
      .from("events")
      .select("id")
      .eq("host_id", user.id)
      .eq("date", form.date)
      .ilike("title", form.title.trim())
      .ilike("location", form.location.trim())
      .limit(1);
    // A failed check must not block hosting — if we can't tell, let it
    // through. The read-side dedupe still catches it in the feed.
    if (clashErr) {
      console.error("duplicate check failed", clashErr.message);
    } else if (clash && clash.length > 0) {
      setError(
        "You've already listed this event on this date at this venue. Open it from your dashboard to edit it instead."
      );
      setLoading(false);
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

    // Extra pictures. One failing shouldn't lose the whole event, so a bad
    // upload is skipped and the rest go up.
    const galleryUrls: string[] = [];
    for (const file of extraFiles.slice(0, MAX_EXTRA)) {
      try {
        const optimized = await compressImage(file, { maxDimension: 1600 });
        const ext = optimized.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${Date.now()}-${galleryUrls.length}.${ext}`;
        const { error: gErr } = await supabase.storage
          .from("event-covers")
          .upload(path, optimized, { upsert: true, cacheControl: "3600" });
        if (gErr) continue;
        galleryUrls.push(
          supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl
        );
      } catch {
        /* skip this one */
      }
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
      gallery_urls: galleryUrls,
    };

    /**
     * min_attendees arrives with migration-quorum.sql. Until that runs the
     * column doesn't exist, and including it would make every insert fail
     * with "column does not exist" — breaking event creation for everyone to
     * ship a feature nobody can use yet.
     *
     * So it's attached separately and stripped on that one specific error,
     * exactly as the venues query already falls back to its legacy column set.
     * Below 2 is meaningless: one person is not a room.
     */
    const minAttendees =
      form.min_attendees &&
      Number(form.min_attendees) >= 2 &&
      // Someone can set a minimum, then go back and add a price. The field
      // hides but the value stays in state, so drop it here too.
      Number(form.price || 0) === 0
        ? Number(form.min_attendees)
        : null;
    // Columns that arrive with a migration. Attached separately so a database
    // that hasn't run one yet still accepts the insert — hosting must not
    // break to ship a field nobody can use yet.
    const optional: Record<string, unknown> = {};
    if (minAttendees !== null) optional.min_attendees = minAttendees;
    // Empty string would fail a time column; null is "the host didn't say".
    if (form.end_time) optional.end_time = form.end_time;
    // Free only, and only when actually chosen — a host can tick this, then
    // add a price, and the checkbox disappears with the value still in state.
    if (form.auto_confirm && Number(form.price || 0) === 0)
      optional.auto_confirm = true;

    const withQuorum = { ...baseEvent, ...optional };
    const isMissingColumn = (msg?: string | null) =>
      !!msg && /min_attendees|end_time|auto_confirm/.test(msg) && /column/i.test(msg);

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
      gallery_urls: galleryUrls,
        })
        .select("id")
        .single();

      if (sErr) {
        setError(sErr.message);
        setLoading(false);
        return;
      }

      const rows = nextDates(form.date, frequency, 3).map((date) => ({
        ...withQuorum,
        date,
        series_id: series.id,
      }));
      let { error: evErr } = await supabase.from("events").insert(rows);
      // Retry without the quorum column if this database hasn't had
      // migration-quorum.sql run against it yet.
      if (evErr && isMissingColumn(evErr.message)) {
        ({ error: evErr } = await supabase.from("events").insert(
          rows.map((r) => {
            // rows is a union (with/without the column), so destructuring it
            // off doesn't typecheck — drop the key on a copy instead.
            const copy: Record<string, unknown> = { ...r };
            delete copy.min_attendees;
            return copy;
          })
        ));
      }
      if (evErr && /gallery_urls/.test(evErr.message)) {
        ({ error: evErr } = await supabase
          .from("events")
          .insert(rows.map(({ gallery_urls: _drop, ...r }) => r)));
      }
      if (evErr) {
        setError(evErr.message);
        setLoading(false);
        return;
      }

      router.push(`/series/${series.id}`);
      router.refresh();
      return;
    }

    // Same fallback as the series path above.
    let { data, error } = await supabase
      .from("events")
      .insert({ ...withQuorum, date: form.date })
      .select("id")
      .single();
    if (error && isMissingColumn(error.message)) {
      ({ data, error } = await supabase
        .from("events")
        .insert({ ...baseEvent, date: form.date })
        .select("id")
        .single());
    }
    if (error && /gallery_urls/.test(error.message)) {
      const { gallery_urls: _drop, ...withoutGallery } = baseEvent;
      ({ data, error } = await supabase
        .from("events")
        .insert({ ...withoutGallery, date: form.date })
        .select("id")
        .single());
    }

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setError("Event created but could not be opened. Check your dashboard.");
      setLoading(false);
      return;
    }

    // Ticket types, now that there's an id to attach them to.
    //
    // A failure here must NOT lose the event — it already exists and the host
    // is about to be sent to it. They're told instead, and the same editor
    // lives on the event page for a second attempt.
    const rows = tiers
      .map((x, i) => ({
        event_id: data.id,
        name: x.name.trim(),
        price: Math.round(Number(x.price)),
        admits: x.admits ? Math.max(1, Math.round(Number(x.admits))) : null,
        description: x.description.trim() || null,
        sort_order: i,
      }))
      .filter((r) => r.name && Number.isFinite(r.price) && r.price > 0);
    if (rows.length > 0) {
      const { error: tErr } = await supabase.from("ticket_tiers").insert(rows);
      if (tErr) {
        setError(
          /ticket_tiers/.test(tErr.message)
            ? "Event created, but ticket types need supabase/migration-ticket-tiers.sql. Add them from the event page."
            : `Event created, but the ticket types didn't save: ${tErr.message}`
        );
        setLoading(false);
        return;
      }
    }

    // Optionally share the new event to a circle (notifies its members).
    if (postToCircle) {
      await supabase.from("circle_posts").insert({
        circle_id: postToCircle,
        user_id: user.id,
        event_id: data.id,
        content: `📣 New event: ${form.title.trim()}`,
      });
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
              <p className="text-xs">Optional (JPG or PNG)</p>
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

      {/* Up to four more, so five pictures in total. */}
      <div>
        <span className="label">
          More pictures{" "}
          <span className="font-normal text-gray-400">
            ({extraPreviews.length}/{MAX_EXTRA} extra · optional)
          </span>
        </span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {extraPreviews.map((src, i) => (
            <div key={src} className="relative h-20 w-20 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeExtra(i)}
                aria-label={`Remove picture ${i + 1}`}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[13px] leading-none text-white transition hover:bg-black/80"
              >
                ×
              </button>
            </div>
          ))}
          {extraPreviews.length < MAX_EXTRA && (
            <label
              htmlFor="extras"
              className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-gray-200 text-gray-400 transition hover:border-brand/40 hover:text-brand"
            >
              <span className="text-2xl leading-none">+</span>
              <input
                id="extras"
                type="file"
                accept="image/*"
                multiple
                onChange={onPickExtras}
                className="hidden"
              />
            </label>
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          The first image is the cover. These show on the event page.
        </p>
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
            Private events don&apos;t appear in the public feed. Share the event
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
            Starts
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
        <div>
          {/* Optional. Plenty of hangouts genuinely end when they end, and
              forcing a host to guess is worse than the card saying nothing. */}
          <label htmlFor="end_time" className="label">
            Ends{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="end_time"
            type="time"
            value={form.end_time}
            onChange={(e) => update("end_time", e.target.value)}
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
          maxLength={MAX_LOCATION_LENGTH}
          value={form.location}
          onChange={(e) => update("location", e.target.value)}
          placeholder="Hard Rock Cafe, Victoria Island"
          className="input"
        />
        {/* The cap is what stops a whole description landing in here. Say so
            as they approach it rather than truncating silently. */}
        {form.location.length > MAX_LOCATION_LENGTH - 30 && (
          <p className="mt-1 text-xs font-semibold text-amber-600">
            {MAX_LOCATION_LENGTH - form.location.length} characters left — this
            is the venue, put the details in the description.
          </p>
        )}
      </div>

      {/* Instant join.

          Off by default and free-only. "The host approves every guest" is the
          promise the rest of the product is built on, so this is a host
          choosing to waive it for one event, never something applied for
          them. On a paid event the payment is already the gate. */}
      {Number(form.price || 0) === 0 && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-brand/40">
          <input
            type="checkbox"
            checked={form.auto_confirm}
            onChange={(e) => update("auto_confirm", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          />
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-gray-900">
              Let anyone join instantly
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-gray-600">
              They&apos;re confirmed the moment they tap — no waiting, which is
              what people arriving from a link need. You still decide who gets
              into the group chat, and you keep your capacity limit.
            </span>
          </span>
        </label>
      )}

      {/* Minimum before it's on.

          This is the mechanic, not a setting: the median room on the platform
          has one person in it, and nobody wants to be that person. Setting a
          minimum means a guest is agreeing to come only if others do, which
          costs them nothing and is the whole reason to tap join on an event
          that currently has two people. */}
      {/* Free events only. On a paid event the guest pays at request time, so
          a room that never fills would leave us holding their money with no
          refund pipeline to return it. Hidden rather than disabled: a control
          you can see but not use invites the question "why not", and the
          honest answer is "we haven't built refunds yet". */}
      {Number(form.price || 0) === 0 && (
      <div className="rounded-2xl border border-brand/20 bg-brand/[0.04] p-4">
        <label htmlFor="min_attendees" className="label">
          Only happen if enough people join{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="min_attendees"
          type="number"
          min={2}
          max={500}
          value={form.min_attendees}
          onChange={(e) => update("min_attendees", e.target.value)}
          placeholder="e.g. 6"
          className="input"
        />
        <p className="mt-1.5 text-[13px] leading-snug text-gray-600">
          Guests see a countdown instead of an empty guest list, and they&apos;re
          only committed once it fills. Leave blank for a normal event.
        </p>
      </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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

      {/* Several prices on one event — combo packs, tables, early bird.
          Optional: leave it empty and the single price above is the ticket. */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <label className="label mb-0">
            More ticket types{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <button
            type="button"
            onClick={() =>
              setTiers((t) => [
                ...t,
                { name: "", price: "", admits: "", description: "" },
              ])
            }
            className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700"
          >
            + Add a type
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          For combo packs, table sizes, early bird — anything with its own
          price. Skip it and the price above is the only ticket.
        </p>

        {tiers.length > 0 && (
          <div className="mt-3 space-y-3">
            {tiers.map((row, i) => (
              <div key={i} className="rounded-2xl bg-gray-50 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={row.name}
                    onChange={(e) =>
                      setTiers((t) =>
                        t.map((x, n) =>
                          n === i ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                    maxLength={60}
                    placeholder="Name, e.g. Gold Table"
                    className="input"
                  />
                  <input
                    value={row.price}
                    onChange={(e) =>
                      setTiers((t) =>
                        t.map((x, n) =>
                          n === i ? { ...x, price: e.target.value } : x
                        )
                      )
                    }
                    inputMode="numeric"
                    placeholder="Price, e.g. 280000"
                    className="input"
                  />
                  <input
                    value={row.admits}
                    onChange={(e) =>
                      setTiers((t) =>
                        t.map((x, n) =>
                          n === i ? { ...x, admits: e.target.value } : x
                        )
                      )
                    }
                    inputMode="numeric"
                    placeholder="Admits how many? (blank if not a table)"
                    className="input"
                  />
                  <input
                    value={row.description}
                    onChange={(e) =>
                      setTiers((t) =>
                        t.map((x, n) =>
                          n === i ? { ...x, description: e.target.value } : x
                        )
                      )
                    }
                    placeholder="What's included"
                    className="input"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setTiers((t) => t.filter((_, n) => n !== i))}
                  className="mt-2 text-xs font-bold text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
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

      {myCircles.length > 0 && !isSeries && (
        <div>
          <label htmlFor="postToCircle" className="label">
            Post to a circle{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <select
            id="postToCircle"
            value={postToCircle}
            onChange={(e) => setPostToCircle(e.target.value)}
            className="input cursor-pointer"
          >
            <option value="">Don&apos;t share to a circle</option>
            {myCircles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Shares this event to the circle&apos;s feed and notifies its members.
          </p>
        </div>
      )}

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
        /* The monthly-limit trigger raises a plain Postgres error. Dropping a
           raw exception on someone mid-form is a dead end, so that one case
           gets an actual way out. */
        /Upgrade to Pro/i.test(error) ? (
          <div className="rounded-xl border border-brand/25 bg-brand-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">{error}</p>
            <Link
              href="/pro"
              className="mt-2 inline-flex rounded-full bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
            >
              Go Pro for unlimited hosting
            </Link>
          </div>
        ) : (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )
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

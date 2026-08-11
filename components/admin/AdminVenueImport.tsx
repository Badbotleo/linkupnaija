"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { VENUE_CATEGORIES } from "@/lib/overpass";
import { NIGERIAN_STATES } from "@/lib/constants";
import LineIcon from "../ui/LineIcon";

/**
 * Onboard real venues in bulk, from OpenStreetMap.
 *
 * Search a city and a category, get back places that actually exist there
 * with their real names, addresses, phone numbers and opening hours, tick the
 * ones you want, import.
 *
 * TWO THINGS THIS DELIBERATELY DOESN'T DO.
 *
 * It doesn't take photos from Google Maps. Those are licensed to Google and
 * copying them into our database breaches their terms. Imported venues get
 * the category's stock photo, and the admin swaps in a real one — ideally the
 * venue's own, with permission.
 *
 * It doesn't write descriptions. We haven't been to these places, and a
 * plausible-sounding description of a real business is a claim we can't stand
 * behind. The field is left empty for a human who knows the spot.
 */

interface Candidate {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
}

const field =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none";

export default function AdminVenueImport({ adminId }: { adminId: string }) {
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [category, setCategory] = useState(VENUE_CATEGORIES[1].key);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    place: string;
    total: number;
    alreadyOnboarded: number;
    candidates: Candidate[];
  } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function search() {
    if (!q.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setPicked(new Set());
    try {
      const res = await fetch(
        `/api/admin/venues/discover?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Search failed.");
        return;
      }
      setResult(json);
      // Pre-tick everything: the common case is wanting most of them, and
      // un-ticking a few is less work than ticking twenty.
      setPicked(new Set(json.candidates.map((c: Candidate) => c.id)));
      if (json.candidates.length === 0)
        toast.success(
          json.alreadyOnboarded > 0
            ? "All of those are already onboarded."
            : "Nothing found there — try a bigger city or another category."
        );
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function importPicked() {
    if (!result || picked.size === 0 || importing) return;
    const chosen = result.candidates.filter((c) => picked.has(c.id));
    setImporting(true);

    const rows = chosen.map((c) => ({
      name: c.name,
      category: c.category,
      address: c.address ?? null,
      state: state || null,
      // Category stock photo, not a scraped one. Swap it per venue afterwards.
      image_url: null,
      // Left empty on purpose — see the note at the top of this file.
      description: null,
      phone: c.phone ?? null,
      website: c.website ?? null,
      opening_hours: c.openingHours ?? null,
      is_active: true,
      is_featured: false,
      created_by: adminId,
    }));

    const { data, error } = await supabase
      .from("venues")
      .insert(rows)
      .select("id");
    setImporting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    const n = data?.length ?? 0;
    toast.success(`${n} venue${n === 1 ? "" : "s"} onboarded`);
    // Drop what we just imported so the list can't be added twice.
    setResult({
      ...result,
      candidates: result.candidates.filter((c) => !picked.has(c.id)),
    });
    setPicked(new Set());
  }

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
          }}
          placeholder="City or area, e.g. Wuse 2, Abuja"
          className={field}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={field}
        >
          {VENUE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.emoji} {c.key}
            </option>
          ))}
        </select>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className={field}
        >
          <option value="">State (set on import)</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={search}
          disabled={loading || !q.trim()}
          className="btn-primary rounded-full px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Searching…" : "Find venues"}
        </button>
      </div>

      <p className="mb-4 text-xs text-gray-400">
        Data from OpenStreetMap contributors, ODbL. Photos are category stock —
        swap in a real one per venue. Descriptions are left blank on purpose:
        we haven&apos;t been to these places.
      </p>

      {result && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-600">
              <span className="font-extrabold text-gray-900">
                {result.candidates.length}
              </span>{" "}
              new near {result.place}
              {result.alreadyOnboarded > 0 && (
                <span className="text-gray-400">
                  {" "}
                  · {result.alreadyOnboarded} already onboarded
                </span>
              )}
            </p>
            {result.candidates.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPicked((p) =>
                      p.size === result.candidates.length
                        ? new Set()
                        : new Set(result.candidates.map((c) => c.id))
                    )
                  }
                  className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700"
                >
                  {picked.size === result.candidates.length
                    ? "Clear all"
                    : "Select all"}
                </button>
                <button
                  type="button"
                  onClick={importPicked}
                  disabled={picked.size === 0 || importing}
                  className="btn-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-50"
                >
                  {importing
                    ? "Importing…"
                    : `Onboard ${picked.size} venue${picked.size === 1 ? "" : "s"}`}
                </button>
              </div>
            )}
          </div>

          <ul className="space-y-1.5">
            {result.candidates.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-3 transition hover:border-brand/30">
                  <input
                    type="checkbox"
                    checked={picked.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {c.name}
                    </p>
                    {c.address && (
                      <p className="truncate text-xs text-gray-500">
                        {c.address}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.phone && (
                        <Tag icon="chat">{c.phone}</Tag>
                      )}
                      {c.openingHours && (
                        <Tag icon="clock">{c.openingHours}</Tag>
                      )}
                      {c.website && <Tag icon="pin">Website</Tag>}
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Tag({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
      <LineIcon name={icon} size={10} className="shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  VENUE_CATEGORIES,
  DEFAULT_CENTER,
  geocode,
  fetchVenues,
  distanceKm,
  type Venue,
} from "@/lib/overpass";
import ReservationModal from "./ReservationModal";

const VenuesMap = dynamic(() => import("./VenuesMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[360px] place-items-center rounded-2xl border border-gray-100 bg-gray-50 text-sm text-gray-400">
      Loading map…
    </div>
  ),
});

export default function VenuesExplorer({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [category, setCategory] = useState(VENUE_CATEGORIES[1].key); // Restaurants
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVenue, setModalVenue] = useState<Venue | null>(null);

  const load = useCallback(
    async (lat: number, lng: number, cat: string) => {
      setLoading(true);
      setError(null);
      try {
        const results = await fetchVenues({ lat, lng, category: cat });
        results.sort(
          (a, b) =>
            distanceKm(lat, lng, a.lat, a.lng) -
            distanceKm(lat, lng, b.lat, b.lng)
        );
        setVenues(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load venues.");
        setVenues([]);
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    load(center.lat, center.lng, category);
  }, [center, category, load]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    const place = await geocode(q);
    if (!place) {
      setError(`Couldn't find "${q}" in Nigeria. Try another city or area.`);
      setLoading(false);
      return;
    }
    setCenter(place); // triggers load via effect
  }

  return (
    <div>
      {/* Search */}
      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city or area — e.g. Lekki, Abuja, Ikeja…"
          className="input flex-1"
        />
        <button type="submit" className="btn-primary px-5">
          Search
        </button>
      </form>
      <p className="mt-2 text-sm text-gray-500">
        Showing venues near{" "}
        <span className="font-semibold text-gray-700">{center.label}</span>
      </p>

      {/* Category chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {VENUE_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
              category === c.key
                ? "border-brand bg-brand text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-brand/40 hover:text-brand"
            }`}
          >
            <span className="mr-1" aria-hidden>
              {c.emoji}
            </span>
            {c.key}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="mt-6">
        <VenuesMap center={center} venues={venues} />
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* List */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-gray-900">
          {loading
            ? "Finding venues…"
            : `${venues.length} ${category.toLowerCase()} nearby`}
        </h2>

        {!loading && venues.length === 0 && !error && (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
            No {category.toLowerCase()} found here. Try another area or category.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => {
            const dist = distanceKm(center.lat, center.lng, v.lat, v.lng);
            const cat = VENUE_CATEGORIES.find((c) => c.key === v.category);
            return (
              <div
                key={v.id}
                className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>
                    {cat?.emoji ?? "📍"}
                  </span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand">
                    {v.category}
                  </span>
                  {v.stars ? (
                    <span className="text-xs font-semibold text-amber-500">
                      {"★".repeat(Math.min(5, Math.round(v.stars)))}
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/venues/${v.id}`}
                  className="mt-2 line-clamp-2 font-bold text-gray-900 hover:text-brand"
                >
                  {v.name}
                </Link>
                {v.address && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                    📍 {v.address}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-400">
                  {dist < 1
                    ? `${Math.round(dist * 1000)} m away`
                    : `${dist.toFixed(1)} km away`}
                </p>
                <button
                  type="button"
                  onClick={() => setModalVenue(v)}
                  className="btn-primary mt-4 w-full py-2"
                >
                  Request Reservation
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {modalVenue && (
        <ReservationModal
          venue={modalVenue}
          isLoggedIn={isLoggedIn}
          onClose={() => setModalVenue(null)}
        />
      )}
    </div>
  );
}

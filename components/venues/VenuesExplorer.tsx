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

// Stable per-venue pick from the category's photo pool, so a grid of the
// same category shows varied covers but each venue keeps its photo.
function venuePhoto(pool: string[] | undefined, id: string) {
  const photos = pool && pool.length > 0 ? pool : ["/venues/restaurants.jpg"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return photos[h % photos.length];
}

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
          placeholder="Search a city or area, e.g. Lekki, Abuja, Ikeja…"
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
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
            <p className="text-4xl">🚀</p>
            <h3 className="mt-3 text-lg font-bold text-gray-900">
              {category} in {center.label} — coming soon
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
              We haven&apos;t mapped {category.toLowerCase()} around here yet,
              but new spots land every week. Meanwhile, try another vibe:
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {category !== "Restaurants" && (
                <button
                  type="button"
                  onClick={() => setCategory("Restaurants")}
                  className="btn-outline"
                >
                  🍽️ Try Restaurants
                </button>
              )}
              {center.label !== DEFAULT_CENTER.label && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCenter(DEFAULT_CENTER);
                  }}
                  className="btn-primary"
                >
                  Explore Lagos instead
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => {
            const dist = distanceKm(center.lat, center.lng, v.lat, v.lng);
            const cat = VENUE_CATEGORIES.find((c) => c.key === v.category);
            return (
              <div
                key={v.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Link href={`/venues/${v.id}`} className="relative block h-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={venuePhoto(cat?.photos, v.id)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <span className="absolute bottom-2.5 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-gray-800 backdrop-blur">
                    {cat?.emoji ?? "📍"} {v.category}
                  </span>
                  {v.stars ? (
                    <span className="absolute right-3 top-2.5 rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-amber-300 backdrop-blur">
                      {"★".repeat(Math.min(5, Math.round(v.stars)))}
                    </span>
                  ) : null}
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex-1">
                    <Link
                      href={`/venues/${v.id}`}
                      className="line-clamp-2 font-bold text-gray-900 hover:text-brand"
                    >
                      {v.name}
                    </Link>
                    {v.address && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                        {v.address}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-gray-400">
                      {dist < 1
                        ? `${Math.round(dist * 1000)} m away`
                        : `${dist.toFixed(1)} km away`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalVenue(v)}
                    className="btn-primary mt-4 w-full py-2"
                  >
                    Request Reservation
                  </button>
                </div>
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

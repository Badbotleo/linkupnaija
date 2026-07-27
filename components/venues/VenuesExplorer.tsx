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
import LineIcon from "../ui/LineIcon";
import { createClient } from "@/lib/supabase/client";

interface PartnerVenue {
  id: string;
  name: string;
  category: string;
  address: string | null;
  state: string | null;
  image_url: string | null;
  description: string | null;
  price_range: string | null;
}

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
  const [mapOpen, setMapOpen] = useState(true);
  // Venues we've actually onboarded — real photos and details, shown above the
  // OpenStreetMap results for the same category.
  const [partners, setPartners] = useState<PartnerVenue[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("venues")
      .select("id, name, category, address, state, image_url, description, price_range")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .then(({ data }) => setPartners((data ?? []) as PartnerVenue[]));
  }, []);

  // Remember whether the map was folded away.
  useEffect(() => {
    const saved = localStorage.getItem("venues:mapOpen");
    if (saved !== null) setMapOpen(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("venues:mapOpen", mapOpen ? "1" : "0");
  }, [mapOpen]);

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

      {/* Map — foldable, because on a phone it eats the whole screen before
          you ever reach the list. Choice sticks between visits. */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setMapOpen((v) => !v)}
          aria-expanded={mapOpen}
          aria-controls="venues-map"
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left shadow-card transition hover:border-brand/30"
        >
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-brand">
              <LineIcon name="pin" size={16} />
            </span>
            <span>
              <span className="block text-sm font-bold text-gray-900">Map view</span>
              <span className="block text-xs text-gray-500">
                {mapOpen ? "Tap to hide the map" : `${venues.length} pin${venues.length === 1 ? "" : "s"} near ${center.label}`}
              </span>
            </span>
          </span>
          <span
            aria-hidden
            className={`shrink-0 text-gray-400 transition-transform duration-300 ${mapOpen ? "rotate-180" : ""}`}
          >
            <LineIcon name="chevronDown" size={18} />
          </span>
        </button>

        <div
          id="venues-map"
          className={`grid transition-all duration-300 ease-out ${
            mapOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <VenuesMap center={center} venues={venues} />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Onboarded partners for this category — real photos, real details */}
      {partners.filter((p) => p.category === category).length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-amber-600">
              <LineIcon name="star" size={13} filled />
            </span>
            Partner venues
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {partners
              .filter((p) => p.category === category)
              .map((p) => (
                <div
                  key={p.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="relative h-32">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url ?? venuePhoto(VENUE_CATEGORIES.find((c) => c.key === p.category)?.photos, p.id)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <span className="absolute left-3 top-2.5 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1A1040]">
                      Partner
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-bold text-gray-900">{p.name}</p>
                    {p.address && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{p.address}</p>
                    )}
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">{p.description}</p>
                    )}
                    {p.price_range && (
                      <p className="mt-1 text-sm font-semibold text-brand">{p.price_range}</p>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setModalVenue({
                          id: `partner-${p.id}`,
                          osmType: "node",
                          osmId: 0,
                          name: p.name,
                          category: p.category,
                          lat: center.lat,
                          lng: center.lng,
                          address: p.address ?? "",
                        })
                      }
                      className="btn-primary mt-4 w-full py-2"
                    >
                      Request Reservation
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
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

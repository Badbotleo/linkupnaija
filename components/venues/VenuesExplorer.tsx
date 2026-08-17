"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { mergePartnersWithOsm } from "@/lib/venue-match";
import { formatPriceRange } from "@/lib/format";
import { openLabel } from "@/lib/opening-hours";
import SwipeDeck from "../home/SwipeDeck";
import VenueArt from "./VenueArt";

interface PartnerVenue {
  id: string;
  name: string;
  category: string;
  address: string | null;
  state: string | null;
  image_url: string | null;
  description: string | null;
  price_range: string | null;
  rating: number | null;
  opening_hours: string | null;
  lat: number | null;
  lng: number | null;
}

/** One row in the unified list — a partner or a plain OpenStreetMap result. */
type Card = {
  key: string;
  name: string;
  category: string;
  address: string | null;
  description: string | null;
  price: string | null;
  /** A venue's own photo, or null — the card draws its own art instead. */
  image: string | null;
  /** Out of 5. Partner venues carry ours; OSM results carry their star count. */
  rating: number | null;
  /** "Open · till 22:00" — already resolved, so cards don't each re-parse. */
  hours: string | null;
  isPartner: boolean;
  distanceKm: number | null;
  href: string | null;
  venue: Venue;
};

// "Request Reservation" said the same flat thing at a nightclub and a cinema.
// Ask for what you'd actually ask for at that kind of place.
const CTA_COPY: Record<string, string> = {
  Restaurants: "Book a table",
  Cafés: "Book a table",
  Clubs: "Reserve a table",
  Bars: "Reserve a table",
  Hotels: "Check availability",
  Cinemas: "Reserve seats",
  Bowling: "Book a lane",
  Karaoke: "Book a room",
  Gyms: "Book a session",
  Golf: "Book a tee time",
  Camping: "Book a pitch",
  "Event Centres": "Enquire about dates",
  Stadiums: "Enquire about dates",
};
const ctaLabel = (category: string) => CTA_COPY[category] ?? "Reserve your spot";

const VenuesMap = dynamic(() => import("./VenuesMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center rounded-2xl border border-gray-100 bg-gray-50 text-sm text-gray-400">
      Loading map…
    </div>
  ),
});

export default function VenuesExplorer({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [category, setCategory] = useState(VENUE_CATEGORIES[1].key);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVenue, setModalVenue] = useState<Venue | null>(null);
  const [mapOpen, setMapOpen] = useState(true);
  const [locating, setLocating] = useState(false);
  const [partners, setPartners] = useState<PartnerVenue[]>([]);

  useEffect(() => {
    const supabase = createClient();
    // rating/opening_hours arrive with migration-venue-ratings-hours.sql.
    // Ask for them, and drop back to the older column set if they aren't
    // there yet — otherwise the whole partner list disappears.
    const BASE = "id, name, category, address, state, image_url, description, price_range, lat, lng";
    const WITH_RATINGS = BASE.replace(", lat", ", rating, opening_hours, lat");
    supabase
      .from("venues")
      .select(WITH_RATINGS)
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .then(async ({ data, error }) => {
        if (!error) {
          setPartners((data ?? []) as unknown as PartnerVenue[]);
          return;
        }
        const { data: legacy } = await supabase
          .from("venues")
          .select(BASE)
          .eq("is_active", true)
          .order("is_featured", { ascending: false });
        setPartners(
          ((legacy ?? []) as unknown as Omit<
            PartnerVenue,
            "rating" | "opening_hours"
          >[]).map(
            (v) => ({ ...v, rating: null, opening_hours: null })
          )
        );
      });
  }, []);

  // Remember whether the map was folded away. Phones and tablets only — on a
  // desktop it lives in its own column and is always up.
  useEffect(() => {
    const saved = localStorage.getItem("venues:mapOpen");
    if (saved !== null) setMapOpen(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("venues:mapOpen", mapOpen ? "1" : "0");
  }, [mapOpen]);

  const load = useCallback(async (lat: number, lng: number, cat: string) => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchVenues({ lat, lng, category: cat });
      results.sort(
        (a, b) =>
          distanceKm(lat, lng, a.lat, a.lng) - distanceKm(lat, lng, b.lat, b.lng)
      );
      setVenues(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load venues.");
      setVenues([]);
    }
    setLoading(false);
  }, []);

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
    setCenter(place);
  }

  // A venue finder that can't answer "what's near me" is missing the point.
  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser won't share a location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setQuery("");
        setCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "your location",
        });
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location — search a city instead.");
      },
      { timeout: 10_000 }
    );
  }

  const categoryPartners = useMemo(
    () => partners.filter((p) => p.category === category),
    [partners, category]
  );

  // A venue we've onboarded also comes back from OpenStreetMap, so it rendered
  // twice. The partner claims its twin and inherits its coordinates (partner
  // rows have no lat/lng), so it gets a pin instead of a duplicate.
  const { osmOnly, located } = useMemo(
    () => mergePartnersWithOsm(categoryPartners, venues),
    [categoryPartners, venues]
  );

  // The grid is everything else nearby. Partners live in the deck above, so
  // listing them here too would re-create exactly the duplication this page
  // just got rid of.
  const cards: Card[] = useMemo(() => {
    const cat = VENUE_CATEGORIES.find((c) => c.key === category);
    return osmOnly.map((v) => ({
      key: v.id,
      name: v.name,
      category: v.category,
      address: v.address || null,
      description: null,
      price: null,
      // OSM results never carry a photo of the actual place, so the pool
      // was always a stand-in. Draw it instead — see VenueArt.
      image: null,
      rating: v.stars ?? null,
      hours: openLabel(v.openingHours),
      isPartner: false,
      distanceKm: distanceKm(center.lat, center.lng, v.lat, v.lng),
      href: `/venues/${v.id}`,
      venue: v,
    }));
  }, [osmOnly, category, center]);

  const pinCount = osmOnly.length + located.length;

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Search — sticky, the way an app keeps its search bar in reach     */}
      {/* ---------------------------------------------------------------- */}
      <div className="sticky top-16 z-20 -mx-4 bg-[#F7F7F9]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <form onSubmit={onSearch} className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 focus-within:border-brand">
            <LineIcon name="search" size={17} className="shrink-0 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Lekki, Wuse 2, Ikeja…"
              aria-label="Search a city or area"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            title="Use my location"
            aria-label="Use my location"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gray-200 bg-white text-brand transition hover:border-brand/40 disabled:opacity-50"
          >
            <LineIcon name="pin" size={18} />
          </button>
          <button
            type="submit"
            className="shrink-0 rounded-2xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 sm:px-5"
          >
            Search
          </button>
        </form>

        {/* Category rail — 21 categories were a wrapped chip wall before */}
        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {VENUE_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              aria-pressed={category === c.key}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2.5 text-sm font-bold transition ${
                category === c.key
                  ? "border-brand bg-brand text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:border-brand/40 hover:text-brand"
              }`}
            >
              <span aria-hidden className="mr-1">
                {c.emoji}
              </span>
              {c.key}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {loading
          ? "Looking…"
          : `${categoryPartners.length + cards.length} ${category.toLowerCase()}`}{" "}
        near{" "}
        <span className="font-semibold text-gray-700">{center.label}</span>
      </p>

      {/* Partner venues get a deck of their own — these are the spots we can
          actually book, and they deserve more than a row in a grid. */}
      {categoryPartners.length > 0 && (
        <div className="-mx-4 mt-4 sm:-mx-6 lg:-mx-8">
          <div className="container-page flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-amber-600">
                  <LineIcon name="star" size={13} filled />
                </span>
                Partner venues
              </h2>
              <p className="mt-0.5 text-[13px] text-gray-500">
                Swipe through the spots we can book for you
              </p>
            </div>
          </div>

          <SwipeDeck className="h-[356px]">
            {categoryPartners.map((p) => {
              const pin = located.find((l) => l.id === p.id);
              const price = formatPriceRange(p.price_range);
              const hours = openLabel(p.opening_hours);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setModalVenue({
                      id: `partner-${p.id}`,
                      osmType: "node",
                      osmId: 0,
                      name: p.name,
                      category: p.category,
                      lat: pin?.lat ?? center.lat,
                      lng: pin?.lng ?? center.lng,
                      address: p.address ?? "",
                    })
                  }
                  className="relative block h-full w-full overflow-hidden rounded-3xl text-left shadow-card"
                >
                  {/* A venue's own photo always wins. Without one we draw
                      rather than reach for the stock pool — see VenueArt. */}
                  {p.image_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/35 to-black/10" />
                    </>
                  ) : (
                    <>
                      <VenueArt
                        name={p.name}
                        category={p.category}
                        className="absolute inset-0 h-full w-full"
                      />
                      {/* Lighter than the photo scrim: the art is already dark
                          and tuned for white text, so the full gradient just
                          muddied it. */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    </>
                  )}

                  <span className="absolute left-4 top-4 rounded-full bg-[#FAC775] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#121212]">
                    Partner
                  </span>
                  {p.rating !== null && (
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-[#FAC775] backdrop-blur">
                      <LineIcon name="star" size={12} filled />
                      {p.rating.toFixed(1)}
                    </span>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="text-[21px] font-extrabold leading-tight">
                      {p.name}
                    </p>
                    {p.address && (
                      <p className="mt-1 line-clamp-1 text-sm text-white/75">
                        {p.address}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {price && (
                        <p className="text-sm font-bold text-[#FAC775]">{price}</p>
                      )}
                      {hours && (
                        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80">
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 rounded-full ${
                              hours.startsWith("Open") ? "bg-naija-300" : "bg-white/40"
                            }`}
                          />
                          {hours}
                        </p>
                      )}
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-900">
                      <LineIcon name="calendar" size={14} />
                      {ctaLabel(p.category)}
                    </span>
                  </div>
                </button>
              );
            })}
          </SwipeDeck>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Split view on desktop: list left, map pinned right. Phones and    */}
      {/* tablets keep the foldable map above the list.                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-4 lg:grid lg:grid-cols-[1fr_minmax(340px,38%)] lg:items-start lg:gap-6">
        {/* --- map --- */}
        <div className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-40">
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
            aria-expanded={mapOpen}
            aria-controls="venues-map"
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left shadow-card transition hover:border-brand/30 lg:hidden"
          >
            <span className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-brand">
                <LineIcon name="pin" size={16} />
              </span>
              <span>
                <span className="block text-sm font-bold text-gray-900">
                  Map view
                </span>
                <span className="block text-xs text-gray-500">
                  {mapOpen
                    ? "Tap to hide the map"
                    : `${pinCount} pin${pinCount === 1 ? "" : "s"} near ${center.label}`}
                </span>
              </span>
            </span>
            <span
              aria-hidden
              className={`shrink-0 text-gray-400 transition-transform duration-300 ${
                mapOpen ? "rotate-180" : ""
              }`}
            >
              <LineIcon name="chevronDown" size={18} />
            </span>
          </button>

          <div
            id="venues-map"
            className={`grid transition-all duration-300 ease-out lg:grid-rows-[1fr] lg:opacity-100 ${
              mapOpen
                ? "mt-3 grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="h-[300px] sm:h-[380px] lg:h-[calc(100vh-13rem)]">
                <VenuesMap
                  center={center}
                  venues={osmOnly}
                  partners={located}
                  height="100%"
                />
              </div>
            </div>
          </div>
        </div>

        {/* --- list --- */}
        <div className="mt-5 lg:col-start-1 lg:row-start-1 lg:mt-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden surface"
                >
                  <div className="aspect-[4/3] w-full animate-pulse bg-gray-100" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                    <div className="h-9 w-full animate-pulse rounded-xl bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : cards.length === 0 && categoryPartners.length === 0 ? (
            <EmptyState
              category={category}
              label={center.label}
              onCategory={setCategory}
              onReset={() => {
                setQuery("");
                setCenter(DEFAULT_CENTER);
              }}
            />
          ) : cards.length === 0 ? null : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((c) => (
                <VenueCard
                  key={c.key}
                  card={c}
                  onReserve={() => setModalVenue(c.venue)}
                />
              ))}
            </div>
          )}
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

/* ------------------------------------------------------------------ */

function VenueCard({ card, onReserve }: { card: Card; onReserve: () => void }) {
  const cover = (
    <div className="relative aspect-[4/3] w-full overflow-hidden">
      {card.image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.image}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        </>
      ) : (
        <VenueArt
          name={card.name}
          category={card.category}
          className="absolute inset-0 h-full w-full transition duration-300 group-hover:scale-105"
        />
      )}
      {card.isPartner && (
        <span className="absolute left-3 top-3 rounded-full bg-[#FAC775] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#121212]">
          Partner
        </span>
      )}
      {card.distanceKm !== null && (
        <span className="absolute bottom-3 left-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-gray-800 backdrop-blur">
          {card.distanceKm < 1
            ? `${Math.round(card.distanceKm * 1000)} m`
            : `${card.distanceKm.toFixed(1)} km`}
        </span>
      )}
      {card.rating !== null && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold text-[#FAC775] backdrop-blur">
          <LineIcon name="star" size={11} filled />
          {card.rating.toFixed(1)}
        </span>
      )}
    </div>
  );

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
        card.isPartner ? "border-amber-200" : "border-gray-100"
      }`}
    >
      {card.href ? (
        <Link href={card.href} className="block">
          {cover}
        </Link>
      ) : (
        cover
      )}

      <div className="flex flex-1 flex-col p-4">
        {card.href ? (
          <Link
            href={card.href}
            className="line-clamp-2 font-bold text-gray-900 hover:text-brand"
          >
            {card.name}
          </Link>
        ) : (
          <p className="line-clamp-2 font-bold text-gray-900">{card.name}</p>
        )}

        {card.address && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">
            {card.address}
          </p>
        )}
        {card.description && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {card.description}
          </p>
        )}
        {card.price && (
          <p className="mt-1.5 text-sm font-bold text-naija-700">{card.price}</p>
        )}
        {card.hours && (
          <p
            className={`mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${
              card.hours.startsWith("Open")
                ? "bg-naija-50 text-naija-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                card.hours.startsWith("Open") ? "bg-naija" : "bg-gray-400"
              }`}
            />
            {card.hours}
          </p>
        )}

        <button
          type="button"
          onClick={onReserve}
          className="group/cta mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition duration-200 hover:shadow-lg hover:brightness-[1.08] active:scale-[0.98]"
        >
          <LineIcon name="calendar" size={15} />
          {ctaLabel(card.category)}
          <LineIcon
            name="chevronRight"
            size={13}
            className="transition-transform duration-200 group-hover/cta:translate-x-0.5"
          />
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  category,
  label,
  onCategory,
  onReset,
}: {
  category: string;
  label: string;
  onCategory: (c: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
      <p className="text-4xl">🚀</p>
      <h3 className="mt-3 text-lg font-bold text-gray-900">
        {category} in {label} — coming soon
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        We haven&apos;t mapped {category.toLowerCase()} around here yet, but new
        spots land every week. Meanwhile, try another vibe:
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {category !== "Restaurants" && (
          <button
            type="button"
            onClick={() => onCategory("Restaurants")}
            className="btn-outline"
          >
            🍽️ Try Restaurants
          </button>
        )}
        {label !== DEFAULT_CENTER.label && (
          <button type="button" onClick={onReset} className="btn-primary">
            Explore Lagos instead
          </button>
        )}
      </div>
    </div>
  );
}

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
import VenuesReel, { type ReelVenue } from "./VenuesReel";
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
  is_featured: boolean | null;
  rating: number | null;
  opening_hours: string | null;
  lat: number | null;
  lng: number | null;
}

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

export default function VenuesExplorer({
  isLoggedIn,
  stateScope = null,
}: {
  isLoggedIn: boolean;
  /**
   * Show only partner venues in this state. Set for Lagos and Abuja, null
   * everywhere else — a state with three venues can't fill a page on its own.
   * OpenStreetMap results are already local, since they come from a radius
   * around the map centre.
   */
  stateScope?: string | null;
}) {
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
    const BASE = "id, name, category, address, state, image_url, description, price_range, is_featured, lat, lng";
    const WITH_RATINGS = BASE.replace(", lat", ", rating, opening_hours, lat");
    // Built rather than chained, so "no scope" means no filter at all. A
    // .filter(..., "not.is", null) would have quietly dropped every venue
    // whose state was unset.
    const scoped = (cols: string) => {
      let q = supabase.from("venues").select(cols).eq("is_active", true);
      if (stateScope) q = q.eq("state", stateScope);
      return q.order("is_featured", { ascending: false });
    };

    scoped(WITH_RATINGS)
      .then(async ({ data, error }) => {
        if (!error) {
          setPartners((data ?? []) as unknown as PartnerVenue[]);
          return;
        }
        // Same scope on the fallback, or a database without the ratings
        // columns would quietly go national again.
        const { data: legacy } = await scoped(BASE);
        setPartners(
          ((legacy ?? []) as unknown as Omit<
            PartnerVenue,
            "rating" | "opening_hours"
          >[]).map(
            (v) => ({ ...v, rating: null, opening_hours: null })
          )
        );
      });
  }, [stateScope]);

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
        setError("Couldn't get your location. Search a city instead.");
      },
      { timeout: 10_000 }
    );
  }

  const categoryPartners = useMemo(
    () => partners.filter((p) => p.category === category),
    [partners, category]
  );

  /**
   * The one we are pushing, and everyone else.
   *
   * A reel gives every slide the same weight, which is the point of a reel
   * and the opposite of what a featured venue is for. So the featured ones
   * keep the deck they had and the rest get the reel.
   *
   * The query orders by is_featured already, so this is a partition of an
   * ordered list rather than a re-sort.
   */
  const [featured, unfeatured] = useMemo(() => {
    const f: PartnerVenue[] = [];
    const u: PartnerVenue[] = [];
    for (const p of categoryPartners) (p.is_featured ? f : u).push(p);
    return [f, u];
  }, [categoryPartners]);

  // A venue we've onboarded also comes back from OpenStreetMap, so it rendered
  // twice. The partner claims its twin and inherits its coordinates (partner
  // rows have no lat/lng), so it gets a pin instead of a duplicate.
  const { osmOnly, located } = useMemo(
    () => mergePartnersWithOsm(categoryPartners, venues),
    [categoryPartners, venues]
  );

  /**
   * One scroll, both sources.
   *
   * The onboarded venues were a reel and everything else nearby was a grid
   * underneath it, so the page asked you to browse the same kind of thing
   * twice in two different shapes and the second one repeated the first's
   * job worse. Ours lead, because those are the ones we can actually book.
   */
  const reelVenues: ReelVenue[] = useMemo(() => {
    const mine: ReelVenue[] = unfeatured.map((p) => {
      const pin = located.find((l) => l.id === p.id);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        address: p.address,
        state: p.state,
        image: p.image_url,
        description: p.description,
        price: formatPriceRange(p.price_range),
        rating: p.rating,
        hours: openLabel(p.opening_hours),
        href: `/venues/${p.id}`,
        distanceKm: pin
          ? distanceKm(center.lat, center.lng, pin.lat, pin.lng)
          : null,
        isPartner: true,
      };
    });

    const theirs: ReelVenue[] = osmOnly.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      address: v.address || null,
      state: null,
      // OSM never carries a photo of the actual place, so the pool was always
      // a stand-in. The slide draws its own art instead.
      image: null,
      description: null,
      price: null,
      rating: v.stars ?? null,
      hours: openLabel(v.openingHours),
      href: `/venues/${v.id}`,
      distanceKm: distanceKm(center.lat, center.lng, v.lat, v.lng),
      isPartner: false,
    }));

    return [...mine, ...theirs];
  }, [unfeatured, osmOnly, located, center]);

  const pinCount = osmOnly.length + located.length;

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Search — sticky, the way an app keeps its search bar in reach     */}
      {/* ---------------------------------------------------------------- */}
      <div className="sticky top-16 z-20 -mx-4 bg-[#F7F7F9]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:bg-[#121212]/90">
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
          : `${featured.length + reelVenues.length} ${category.toLowerCase()}`}{" "}
        near{" "}
        <span className="font-semibold text-gray-700">{center.label}</span>
      </p>

      {/* Featured venues get a deck of their own: these are the spots we can
          actually book, and they deserve more than a row in a grid.

          Called "Featured" rather than "Partner" because that is what it
          means to somebody browsing. "Partner" describes our commercial
          relationship, which is our business and not the reason anybody picks
          a restaurant. */}
      {featured.length > 0 && (
        <div className="-mx-4 mt-4 sm:-mx-6 lg:-mx-8">
          <div className="container-page flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-amber-600">
                  <LineIcon name="star" size={13} filled />
                </span>
                Featured venues
              </h2>
              <p className="mt-0.5 text-[13px] text-gray-500">
                Swipe through the spots we can book for you
              </p>
            </div>
          </div>

          <SwipeDeck className="h-[356px]">
            {featured.map((p) => {
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
                    Featured
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

      {/* Every other spot we can book, one per screen.
          The deck above is for the handful being pushed; this is the long
          tail the importer produces, and a horizontal rail made its fortieth
          entry effectively unreachable. */}
      {reelVenues.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
                More spots
              </h2>
              <p className="mt-0.5 text-[13px] text-gray-500">
                Scroll through {reelVenues.length} places we can book
              </p>
            </div>
          </div>
          <VenuesReel
            venues={reelVenues}
            ctaLabel={(v) => ctaLabel(v.category)}
            onReserve={(id) => {
              const p = unfeatured.find((x) => x.id === id);
              if (!p) return;
              const pin = located.find((l) => l.id === p.id);
              setModalVenue({
                id: `partner-${p.id}`,
                osmType: "node",
                osmId: 0,
                name: p.name,
                category: p.category,
                // A partner row carries no coordinates of its own; it
                // inherits them from the OSM twin it claimed, and falls back
                // to the map centre when it has no twin.
                lat: pin?.lat ?? center.lat,
                lng: pin?.lng ?? center.lng,
                address: p.address ?? "",
              });
            }}
          />
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
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-card transition hover:border-brand/30 lg:hidden"
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

        {/* --- nothing to list --- */}
        {/* The grid that lived here is gone. It repeated the reel's job in a
            worse format, so the page asked you to browse the same places
            twice. Only the empty state is left, because "we found nothing
            here" still has to be said somewhere. */}
        <div className="mt-5 lg:col-start-1 lg:row-start-1 lg:mt-0">
          {loading ? (
            <div className="h-[420px] animate-pulse rounded-3xl bg-gray-100" />
          ) : reelVenues.length === 0 && featured.length === 0 ? (
            <EmptyState
              category={category}
              label={center.label}
              onCategory={setCategory}
              onReset={() => {
                setQuery("");
                setCenter(DEFAULT_CENTER);
              }}
            />
          ) : null}
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

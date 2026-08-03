// Venue discovery via free OpenStreetMap services — Nominatim (geocoding)
// and the Overpass API (POI data). No API keys required.

export interface Venue {
  id: string; // "node-123" / "way-456"
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  openingHours?: string;
  stars?: number;
  phone?: string;
  website?: string;
}

export interface VenueCategory {
  key: string;
  emoji: string;
  photos: string[]; // stock photo pool for venue cards (public/venues) — a
  // per-venue hash picks one so a grid of the same category varies. Every
  // photo shows a group of people, never an empty room or a solo subject.
  filters: [string, string][]; // OSM key/value pairs
}

export const VENUE_CATEGORIES: VenueCategory[] = [
  { key: "Clubs", emoji: "🪩", photos: ["/venues/clubs.jpg", "/venues/clubs-2.jpg"], filters: [["amenity", "nightclub"]] },
  { key: "Restaurants", emoji: "🍽️", photos: ["/venues/restaurants.jpg", "/venues/restaurants-2.jpg"], filters: [["amenity", "restaurant"]] },
  { key: "Cinemas", emoji: "🎬", photos: ["/venues/cinemas.jpg"], filters: [["amenity", "cinema"]] },
  { key: "Parks", emoji: "🌳", photos: ["/venues/parks.jpg"], filters: [["leisure", "park"]] },
  {
    key: "Bars",
    emoji: "🍺",
    photos: ["/venues/rooftops.jpg"],
    filters: [
      ["amenity", "bar"],
      ["amenity", "pub"],
    ],
  },
  { key: "Gyms", emoji: "🏋️", photos: ["/venues/gyms.jpg"], filters: [["leisure", "fitness_centre"]] },
  { key: "Bowling", emoji: "🎳", photos: ["/venues/bowling.jpg"], filters: [["leisure", "bowling_alley"]] },
  { key: "Karaoke", emoji: "🎤", photos: ["/venues/karaoke.jpg"], filters: [["amenity", "karaoke_box"]] },
  { key: "Museums", emoji: "🏛️", photos: ["/venues/museums.jpg"], filters: [["tourism", "museum"]] },
  { key: "Beaches", emoji: "🏖️", photos: ["/venues/beaches.jpg"], filters: [["natural", "beach"]] },
  { key: "Stadiums", emoji: "🏟️", photos: ["/venues/stadiums.jpg"], filters: [["leisure", "stadium"]] },
  { key: "Hotels", emoji: "🏨", photos: ["/venues/hotels.jpg"], filters: [["tourism", "hotel"]] },
  { key: "Camping", emoji: "⛺", photos: ["/venues/parks.jpg"], filters: [["tourism", "camp_site"], ["tourism", "caravan_site"]] },
  { key: "Cafés", emoji: "☕", photos: ["/venues/restaurants-2.jpg"], filters: [["amenity", "cafe"]] },
  { key: "Event Centres", emoji: "🎪", photos: ["/venues/hotels.jpg"], filters: [["amenity", "events_venue"], ["amenity", "conference_centre"]] },
  { key: "Art Galleries", emoji: "🖼️", photos: ["/venues/museums.jpg"], filters: [["tourism", "gallery"], ["tourism", "artwork"]] },
  { key: "Amusement Parks", emoji: "🎡", photos: ["/venues/parks.jpg"], filters: [["tourism", "theme_park"], ["leisure", "water_park"]] },
  { key: "Golf", emoji: "⛳", photos: ["/venues/parks.jpg"], filters: [["leisure", "golf_course"]] },
  { key: "Swimming", emoji: "🏊", photos: ["/venues/hotels.jpg"], filters: [["leisure", "swimming_pool"], ["leisure", "water_park"]] },
  { key: "Malls", emoji: "🛍️", photos: ["/venues/restaurants.jpg"], filters: [["shop", "mall"]] },
  { key: "Arcades", emoji: "🕹️", photos: ["/venues/bowling.jpg"], filters: [["leisure", "amusement_arcade"]] },
];

export const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792, label: "Lagos" }; // Lagos

export function categoryByKey(key: string): VenueCategory {
  return VENUE_CATEGORIES.find((c) => c.key === key) ?? VENUE_CATEGORIES[1];
}

// Per-tab memo on top of the server's shared cache — flipping back to a
// category you just looked at shouldn't touch the network at all.
const cache = new Map<string, { at: number; venues: Venue[] }>();
const CACHE_TTL_MS = 5 * 60_000;

/**
 * Venues near a point, via our own cached proxy at /api/venues/nearby.
 *
 * The browser used to query Overpass directly: slow from Nigerian mobile
 * data, rate-limited per visitor, and with nothing shared between them. This
 * never throws — the venues page always has partner venues to show, and an
 * exception here used to blank the entire list.
 */
export async function fetchVenues(opts: {
  lat: number;
  lng: number;
  category: string;
  radius?: number;
}): Promise<Venue[]> {
  const cat = categoryByKey(opts.category);
  const radius = opts.radius ?? 6000;
  const key = `${opts.lat.toFixed(3)},${opts.lng.toFixed(3)},${cat.key},${radius}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.venues;

  const qs = new URLSearchParams({
    lat: String(opts.lat),
    lng: String(opts.lng),
    category: cat.key,
    radius: String(radius),
  });

  try {
    const res = await fetch(`/api/venues/nearby?${qs}`);
    const data = (await res.json()) as { venues?: Venue[] };
    const venues = data.venues ?? [];
    cache.set(key, { at: Date.now(), venues });
    return venues;
  } catch {
    return hit?.venues ?? [];
  }
}

/** Geocode a Nigerian city/area to a centre point, server-side. */
export async function geocode(
  query: string
): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const res = await fetch(`/api/venues/geocode?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lat?: number;
      lng?: number;
      label?: string;
    };
    if (data.lat == null || data.lng == null) return null;
    return { lat: data.lat, lng: data.lng, label: data.label ?? query };
  } catch {
    return null;
  }
}

/** One OpenStreetMap venue by encoded id, via our proxy. */
export async function fetchVenueById(id: string): Promise<Venue | null> {
  try {
    const res = await fetch(`/api/venues/detail?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return (await res.json()) as Venue;
  } catch {
    return null;
  }
}

/** Distance in km between two points (Haversine). */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

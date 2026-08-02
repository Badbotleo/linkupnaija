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

// The main Overpass instance is heavily rate-limited and regularly answers
// 429/504 — that alone was the "map fails too often" report. Try the mirrors
// in turn instead of surfacing the first failure to the user.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Measured: overpass-api.de answers in ~2s, kumi.systems can hang past 10s.
// Cap each attempt so one bad mirror costs seconds, not the whole page load.
const REQUEST_TIMEOUT_MS = 8_000;

// The mirror that answered last time goes first next time — after one bad
// mirror we stop paying its timeout on every subsequent search.
let preferredMirror = OVERPASS_MIRRORS[0];

// Re-selecting a category you already looked at shouldn't hit the network
// again. Keyed by rounded position + category; cleared on reload.
const cache = new Map<string, { at: number; venues: Venue[] }>();
const CACHE_TTL_MS = 5 * 60_000;

/** fetch with a hard timeout — a hung mirror must not hang the whole page. */
async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Run an Overpass query, falling through the mirrors until one answers.
 * Only throws once every mirror has failed.
 */
async function overpass(query: string): Promise<{ elements: OverpassElement[] }> {
  let lastError: unknown;
  const order = [
    preferredMirror,
    ...OVERPASS_MIRRORS.filter((m) => m !== preferredMirror),
  ];
  for (const url of order) {
    try {
      const res = await timedFetch(url, { method: "POST", body: query });
      if (!res.ok) {
        lastError = new Error(`${url} responded ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements: OverpassElement[] };
      preferredMirror = url;
      return json;
    } catch (err) {
      lastError = err;
    }
  }
  console.error("All Overpass mirrors failed:", lastError);
  throw new Error(
    "The venue map is having a moment — every map server we use is busy. Try again in a few seconds."
  );
}

export function categoryByKey(key: string): VenueCategory {
  return VENUE_CATEGORIES.find((c) => c.key === key) ?? VENUE_CATEGORIES[1];
}

/** Geocode a Nigerian city/area to a center point. */
export async function geocode(
  query: string
): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=ng&q=${encodeURIComponent(
    query
  )}`;
  let res: Response;
  try {
    res = await timedFetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  if (!data.length) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    label: data[0].display_name.split(",").slice(0, 2).join(", "),
  };
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function tagsToAddress(t: Record<string, string>): string {
  const parts = [
    [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
    t["addr:suburb"] ?? t["addr:neighbourhood"],
    t["addr:city"],
    t["addr:state"],
  ].filter(Boolean);
  return parts.join(", ");
}

function toVenue(el: OverpassElement, category: string): Venue | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const tags = el.tags ?? {};
  if (lat == null || lng == null || !tags.name) return null;
  return {
    id: `${el.type}-${el.id}`,
    osmType: el.type,
    osmId: el.id,
    name: tags.name,
    category,
    lat,
    lng,
    address: tagsToAddress(tags),
    openingHours: tags.opening_hours,
    stars: tags.stars ? Number(tags.stars) : undefined,
    phone: tags["contact:phone"] ?? tags.phone,
    website: tags["contact:website"] ?? tags.website,
  };
}

function buildQuery(
  filters: [string, string][],
  lat: number,
  lng: number,
  radius: number
): string {
  const selectors = filters
    .flatMap(([k, v]) =>
      ["node", "way"].map(
        (t) => `${t}["${k}"="${v}"](around:${radius},${lat},${lng});`
      )
    )
    .join("");
  return `[out:json][timeout:25];(${selectors});out center 80;`;
}

/** Fetch venues of a category near a point. */
export async function fetchVenues(opts: {
  lat: number;
  lng: number;
  category: string;
  radius?: number;
}): Promise<Venue[]> {
  const cat = categoryByKey(opts.category);
  const key = `${opts.lat.toFixed(3)},${opts.lng.toFixed(3)},${cat.key},${opts.radius ?? 6000}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.venues;

  const query = buildQuery(cat.filters, opts.lat, opts.lng, opts.radius ?? 6000);
  const data = await overpass(query);
  const seen = new Set<string>();
  const venues: Venue[] = [];
  for (const el of data.elements ?? []) {
    const v = toVenue(el, opts.category);
    if (v && !seen.has(v.name)) {
      seen.add(v.name);
      venues.push(v);
    }
  }
  cache.set(key, { at: Date.now(), venues });
  return venues;
}

/** Fetch a single venue by its encoded id ("node-123"). */
export async function fetchVenueById(id: string): Promise<Venue | null> {
  const [type, rawId] = id.split("-");
  if (!["node", "way", "relation"].includes(type) || !rawId) return null;
  const query = `[out:json][timeout:25];${type}(${rawId});out center 1;`;
  let data: { elements: OverpassElement[] };
  try {
    data = await overpass(query);
  } catch {
    return null;
  }
  const el = data.elements?.[0];
  if (!el) return null;
  // Infer a display category from tags.
  const tags = el.tags ?? {};
  const match = VENUE_CATEGORIES.find((c) =>
    c.filters.some(([k, v]) => tags[k] === v)
  );
  return toVenue(el, match?.key ?? "Venue");
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

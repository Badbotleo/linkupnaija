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
  filters: [string, string][]; // OSM key/value pairs
}

export const VENUE_CATEGORIES: VenueCategory[] = [
  { key: "Clubs", emoji: "🪩", filters: [["amenity", "nightclub"]] },
  { key: "Restaurants", emoji: "🍽️", filters: [["amenity", "restaurant"]] },
  { key: "Cinemas", emoji: "🎬", filters: [["amenity", "cinema"]] },
  { key: "Parks", emoji: "🌳", filters: [["leisure", "park"]] },
  {
    key: "Bars",
    emoji: "🍺",
    filters: [
      ["amenity", "bar"],
      ["amenity", "pub"],
    ],
  },
  { key: "Gyms", emoji: "🏋️", filters: [["leisure", "fitness_centre"]] },
  { key: "Bowling", emoji: "🎳", filters: [["leisure", "bowling_alley"]] },
  { key: "Karaoke", emoji: "🎤", filters: [["amenity", "karaoke_box"]] },
  { key: "Museums", emoji: "🏛️", filters: [["tourism", "museum"]] },
  { key: "Beaches", emoji: "🏖️", filters: [["natural", "beach"]] },
  { key: "Stadiums", emoji: "🏟️", filters: [["leisure", "stadium"]] },
  { key: "Hotels", emoji: "🏨", filters: [["tourism", "hotel"]] },
];

export const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792, label: "Lagos" }; // Lagos

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

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
  const res = await fetch(url, { headers: { Accept: "application/json" } });
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
  const query = buildQuery(cat.filters, opts.lat, opts.lng, opts.radius ?? 6000);
  const res = await fetch(OVERPASS_URL, { method: "POST", body: query });
  if (!res.ok) throw new Error("Could not load venues. Please try again.");
  const data = (await res.json()) as { elements: OverpassElement[] };
  const seen = new Set<string>();
  const venues: Venue[] = [];
  for (const el of data.elements ?? []) {
    const v = toVenue(el, opts.category);
    if (v && !seen.has(v.name)) {
      seen.add(v.name);
      venues.push(v);
    }
  }
  return venues;
}

/** Fetch a single venue by its encoded id ("node-123"). */
export async function fetchVenueById(id: string): Promise<Venue | null> {
  const [type, rawId] = id.split("-");
  if (!["node", "way", "relation"].includes(type) || !rawId) return null;
  const query = `[out:json][timeout:25];${type}(${rawId});out center 1;`;
  const res = await fetch(OVERPASS_URL, { method: "POST", body: query });
  if (!res.ok) return null;
  const data = (await res.json()) as { elements: OverpassElement[] };
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

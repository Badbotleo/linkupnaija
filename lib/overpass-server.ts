import {
  VENUE_CATEGORIES,
  categoryByKey,
  type Venue,
} from "./overpass";

/**
 * Server-only Overpass access.
 *
 * This used to run in the browser, which meant every visitor hammered a
 * volunteer-run server directly — slow from Nigerian mobile data, rate-limited,
 * and with no shared cache. It lives behind /api/venues/nearby now, so one
 * fetch serves everyone and a bad mirror is our problem, not theirs.
 */

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
/**
 * Bulk admin searches get longer.
 *
 * 8s is right for the live venue map, where a person is staring at a spinner
 * and a fast wrong answer beats a slow right one. It is wrong for an admin
 * importing a city: the Overpass query itself asks for up to 25s, so an 8s
 * abort killed every mirror in turn and reported "rate-limited" for what was
 * really us hanging up first.
 */
export const BULK_TIMEOUT_MS = 28_000;

// The mirror that answered last time goes first next time — after one bad
// mirror we stop paying its timeout on every subsequent search.
let preferredMirror = OVERPASS_MIRRORS[0];


/** fetch with a hard timeout — a hung mirror must not hang the whole page. */
async function timedFetch(
  url: string,
  init?: RequestInit,
  timeoutMs?: number
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs ?? REQUEST_TIMEOUT_MS);
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
async function overpass(
  query: string,
  timeoutMs?: number
): Promise<{ elements: OverpassElement[] }> {
  let lastError: unknown;
  const order = [
    preferredMirror,
    ...OVERPASS_MIRRORS.filter((m) => m !== preferredMirror),
  ];
  for (const url of order) {
    try {
      const res = await timedFetch(
        url,
        {
          method: "POST",
          body: query,
          // Overpass answers 504 to requests with no User-Agent — it
          // deprioritises anonymous clients, exactly as Nominatim does. The
          // geocoder below already identified itself; this never did, so
          // every mirror "timed out" and we blamed rate limiting for what was
          // really us refusing to say who we were.
          headers: {
            "User-Agent": "LinkUpNaija/1.0 (support@linkupnaija.com)",
            "Content-Type": "text/plain;charset=UTF-8",
          },
        },
        timeoutMs
      );
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
export async function fetchVenuesFromOverpass(opts: {
  lat: number;
  lng: number;
  category: string;
  radius?: number;
  /** Longer for admin bulk imports — see BULK_TIMEOUT_MS. */
  timeoutMs?: number;
}): Promise<Venue[]> {
  const cat = categoryByKey(opts.category);
  const query = buildQuery(cat.filters, opts.lat, opts.lng, opts.radius ?? 6000);
  const data = await overpass(query, opts.timeoutMs);
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

/** One venue by its encoded id ("node-123"). */
export async function fetchVenueByIdFromOverpass(id: string): Promise<Venue | null> {
  const [type, rawId] = id.split("-");
  if (!["node", "way", "relation"].includes(type) || !rawId) return null;
  let data: { elements: OverpassElement[] };
  try {
    data = await overpass(`[out:json][timeout:25];${type}(${rawId});out center 1;`);
  } catch {
    return null;
  }
  const el = data.elements?.[0];
  if (!el) return null;
  const tags = el.tags ?? {};
  const match = VENUE_CATEGORIES.find((c) =>
    c.filters.some(([k, v]) => tags[k] === v)
  );
  return toVenue(el, match?.key ?? "Venue");
}

/** Geocode a Nigerian city/area. Server-side so we can identify ourselves. */
export async function geocodeOnServer(
  query: string
): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=ng&q=${encodeURIComponent(query)}`;
  try {
    const res = await timedFetch(url, {
      headers: {
        Accept: "application/json",
        // Nominatim's usage policy requires a identifying UA.
        "User-Agent": "LinkUpNaija/1.0 (support@linkupnaija.com)",
      },
    });
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
  } catch {
    return null;
  }
}

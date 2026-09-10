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
/**
 * How long ONE mirror gets. Not how long the caller waits.
 *
 * This was 8s on a measurement that has since gone stale. Measured again on
 * 10 Sep 2026, Victoria Island restaurants, the real 5km query: the only
 * mirror that answered took 11.3 SECONDS, and returned 73 venues once it was
 * allowed to finish. So the live map aborted the one
 * working server every single time, then spent 8s each on three that were
 * not answering at all, and reported a rate limit after half a minute of
 * hanging up on people.
 *
 * A single attempt is allowed to be slow now, because a slow attempt no
 * longer blocks the others: the hedge below starts the next mirror alongside
 * rather than after.
 */
const REQUEST_TIMEOUT_MS = 16_000;

/**
 * How long before we stop waiting on one mirror and ALSO try the next.
 *
 * The point of falling through mirrors is surviving a dead one, and serially
 * that costs a full timeout each. Overlapping them costs this instead. Kept
 * above the ~2s a healthy Overpass takes, so an ordinary fast answer never
 * touches a second server.
 */
const HEDGE_AFTER_MS = 4_000;
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
 * Run an Overpass query against the mirrors, overlapping rather than queueing.
 *
 * The old shape was a for-loop: try one, wait for it to fail, try the next.
 * That makes the cost of a dead mirror a full timeout, paid before the
 * healthy one is even contacted, and with three of four unreachable it meant
 * the answer arrived long after the caller had given up.
 *
 * This starts the preferred mirror, and if it has not answered within
 * HEDGE_AFTER_MS brings in the next one alongside it, and so on. First usable
 * response wins and the rest are aborted. A fast mirror is still the only one
 * contacted, so this is not a broadcast to four volunteer servers on every
 * search: it only widens when something is actually wrong.
 */
async function overpass(
  query: string,
  timeoutMs?: number
): Promise<{ elements: OverpassElement[] }> {
  const order = [
    preferredMirror,
    ...OVERPASS_MIRRORS.filter((m) => m !== preferredMirror),
  ];
  const budget = timeoutMs ?? REQUEST_TIMEOUT_MS;
  const ctrl = new AbortController();
  const errors: unknown[] = [];

  /**
   * 502, 503 and 504 mean "I am busy". They are worth asking again.
   *
   * Measured 10 Sep 2026, Abuja restaurants, six runs across two radii: every
   * radius both succeeded and failed. 5km gave 504, then a connection reset,
   * then 200. 3km gave 429, then 504, then 200. A smaller query failing while
   * a larger one succeeded rules out query cost and leaves server load, so
   * shrinking the search area behind the caller's back would be the wrong fix
   * and would also quietly return fewer venues than they asked for.
   *
   * 429 is NOT in this set. It is a rate limit, and retrying a rate limit is
   * the one response guaranteed to make it worse. That one hedges to another
   * mirror instead.
   *
   * ONLY ON A BULK BUDGET. An admin who pressed Search will wait fifteen more
   * seconds for a real answer. A visitor watching the venue map will not, and
   * for them a stale cache beats a spinner, which is what the route already
   * falls back to.
   */
  const RETRYABLE = new Set([502, 503, 504]);
  const mayRetry = budget >= 20_000;

  const attempt = async (url: string, tries = mayRetry ? 2 : 1): Promise<{ elements: OverpassElement[] }> => {
    const res = await fetch(url, {
      method: "POST",
      body: query,
      signal: ctrl.signal,
      // Overpass answers 504 to requests with no User-Agent — it
      // deprioritises anonymous clients, exactly as Nominatim does. The
      // geocoder below already identified itself; this never did, so
      // every mirror "timed out" and we blamed rate limiting for what was
      // really us refusing to say who we were.
      headers: {
        "User-Agent": "LinkUpNaija/1.0 (support@linkupnaija.com)",
        "Content-Type": "text/plain;charset=UTF-8",
      },
    });
    if (!res.ok) {
      if (RETRYABLE.has(res.status) && tries > 1 && !ctrl.signal.aborted) {
        await new Promise((r) => setTimeout(r, 1_200));
        if (ctrl.signal.aborted) throw new Error("aborted");
        return attempt(url, tries - 1);
      }
      throw new Error(`${url} responded ${res.status}`);
    }
    const json = (await res.json()) as { elements: OverpassElement[] };
    // Whoever answered first is asked first next time.
    preferredMirror = url;
    return json;
  };

  try {
    return await new Promise<{ elements: OverpassElement[] }>(
      (resolve, reject) => {
        let settled = false;
        let launched = 0;
        let finished = 0;

        const done = (v: { elements: OverpassElement[] }) => {
          if (settled) return;
          settled = true;
          resolve(v);
        };
        const failed = (err: unknown) => {
          errors.push(err);
          finished += 1;
          // Only give up once every mirror has been started AND has failed.
          if (!settled && launched === order.length && finished === launched) {
            settled = true;
            reject(errors[errors.length - 1]);
          }
        };

        const launch = (i: number) => {
          if (settled || i >= order.length) return;
          launched = i + 1;
          attempt(order[i]).then(done).catch(failed);
          // launch() no-ops once something has answered, so this timer is
          // safe to set unconditionally.
          if (i + 1 < order.length) {
            setTimeout(() => launch(i + 1), HEDGE_AFTER_MS);
          }
        };

        launch(0);
        // Nothing at all within the budget is a failure, not a hang.
        setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Every map server timed out."));
          }
        }, budget);
      }
    );
  } catch (lastError) {
    console.error("All Overpass mirrors failed:", lastError);
    throw new Error(
      "The venue map is having a moment. Every map server we use is busy. Try again in a few seconds."
    );
  } finally {
    // Whether we won or lost, nothing may keep running against a volunteer
    // server for an answer no one is waiting for.
    ctrl.abort();
  }
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

/**
 * Geocode a Nigerian city/area. Server-side so we can identify ourselves.
 *
 * Takes its own timeout, and that is the bug this parameter exists for. The
 * admin importer raised Overpass to BULK_TIMEOUT_MS and left this call on the
 * 8s default, but this runs FIRST: measured 10 Sep 2026, Nominatim answered
 * "Victoria Island Lagos" in 7.8s. So the import died on the geocode about as
 * often as not and told the admin the place could not be found, when the
 * place was found and we hung up on the answer.
 */
export async function geocodeOnServer(
  query: string,
  timeoutMs?: number
): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=ng&q=${encodeURIComponent(query)}`;
  try {
    const res = await timedFetch(
      url,
      {
        headers: {
          Accept: "application/json",
          // Nominatim's usage policy requires a identifying UA.
          "User-Agent": "LinkUpNaija/1.0 (support@linkupnaija.com)",
        },
      },
      timeoutMs
    );
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

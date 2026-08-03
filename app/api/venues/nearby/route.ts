import { NextResponse } from "next/server";
import { categoryByKey, type Venue } from "@/lib/overpass";
import { fetchVenuesFromOverpass } from "@/lib/overpass-server";

export const runtime = "nodejs";

/**
 * Venue lookup, proxied and cached on our side.
 *
 * The browser used to call Overpass directly, which is why the page dragged
 * and the map kept failing:
 *
 *  - every visitor, every category switch, was a fresh request to a
 *    volunteer-run server in Europe or Japan — from Nigerian mobile data that
 *    is a slow round trip before anything renders;
 *  - nothing was shared, so one person's lookup never helped the next;
 *  - Overpass rate-limits hard, and a 429 surfaced as "every map server is
 *    busy" even though the data hadn't changed in months.
 *
 * Now one server fetch per area+category per hour serves everyone, and a
 * failed refresh falls back to the last good answer instead of an error.
 */

// Rounded to ~1km so nearby searches share a cache entry instead of each
// pixel of map movement minting a new one.
function cacheKey(lat: number, lng: number, category: string, radius: number) {
  return `${lat.toFixed(2)},${lng.toFixed(2)},${category},${radius}`;
}

const FRESH_MS = 60 * 60_000; // an hour
const STALE_MS = 7 * 24 * 60 * 60_000; // still better than nothing for a week

const store = new Map<string, { at: number; venues: Venue[] }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const category = url.searchParams.get("category") ?? "Restaurants";
  const radius = Number(url.searchParams.get("radius")) || 6000;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required." }, { status: 400 });
  }

  const cat = categoryByKey(category);
  const key = cacheKey(lat, lng, cat.key, radius);
  const hit = store.get(key);
  const now = Date.now();

  if (hit && now - hit.at < FRESH_MS) {
    return NextResponse.json(
      { venues: hit.venues, cached: true },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  }

  try {
    const venues = await fetchVenuesFromOverpass({
      lat,
      lng,
      category: cat.key,
      radius,
    });
    store.set(key, { at: now, venues });
    return NextResponse.json(
      { venues, cached: false },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (err) {
    // A stale answer beats an empty page. Overpass data is months old anyway.
    if (hit && now - hit.at < STALE_MS) {
      return NextResponse.json(
        { venues: hit.venues, cached: true, stale: true },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    }
    console.error("venues/nearby: all mirrors failed", err);
    // Deliberately 200 with an empty list: the venues page still has partner
    // venues to show, and an error status turns that into a dead screen.
    return NextResponse.json(
      { venues: [], unavailable: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}

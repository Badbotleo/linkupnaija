import { NextResponse } from "next/server";
import { searchPlacesOnServer } from "@/lib/overpass-server";

export const runtime = "nodejs";

/**
 * Venues on the map, by name.
 *
 * The other half of the venues search box: our own rows are searched in the
 * database, and this finds the places nobody has onboarded yet, so typing
 * "Terra Kulture" works whether or not it is one of ours.
 *
 * Behind our own route for the same reason the geocoder is. Nominatim asks
 * that clients identify themselves and keep to roughly a call a second, and
 * one identified caller with a shared cache is the only way to honour that
 * from a browser-driven search box.
 *
 * Twelve hours. A restaurant's position on the map is not news, and a repeat
 * search for the same name is the common case: somebody types, reads, goes
 * back and types nearly the same thing.
 */
const store = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 12 * 60 * 60_000;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  // Two letters matches half of Nigeria and costs a call to find that out.
  if (q.length < 3) return NextResponse.json({ places: [] });

  const key = q.toLowerCase();
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.value);

  const places = await searchPlacesOnServer(q);
  const value = { places };

  // Cached even when empty. "No such venue" is an answer worth keeping, and
  // not keeping it is how a typo gets retried against Nominatim on every
  // render.
  store.set(key, { at: Date.now(), value });
  return NextResponse.json(value, {
    headers: { "Cache-Control": "public, max-age=1800, s-maxage=43200" },
  });
}

import { NextResponse } from "next/server";
import { geocodeOnServer } from "@/lib/overpass-server";

export const runtime = "nodejs";

/**
 * Nominatim asks that clients identify themselves and not hammer it from
 * every browser. Going through here means one identified caller and a shared
 * cache, instead of one anonymous request per visitor keystroke.
 */
const store = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 24 * 60 * 60_000; // place names don't move

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!q) return NextResponse.json({ error: "q is required." }, { status: 400 });

  const key = q.toLowerCase();
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.value);

  const place = await geocodeOnServer(q);
  if (!place) return NextResponse.json({ error: "Not found." }, { status: 404 });

  store.set(key, { at: Date.now(), value: place });
  return NextResponse.json(place, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}

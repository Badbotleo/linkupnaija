import { NextResponse } from "next/server";
import { fetchVenueByIdFromOverpass } from "@/lib/overpass-server";

export const runtime = "nodejs";

/** One OpenStreetMap venue, proxied and cached like the nearby search. */
const store = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 24 * 60 * 60_000;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^(node|way|relation)-\d+$/.test(id)) {
    return NextResponse.json({ error: "Bad venue id." }, { status: 400 });
  }

  const hit = store.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.value);

  const venue = await fetchVenueByIdFromOverpass(id);
  if (!venue) return NextResponse.json({ error: "Not found." }, { status: 404 });

  store.set(id, { at: Date.now(), value: venue });
  return NextResponse.json(venue, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}

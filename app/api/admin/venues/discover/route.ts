import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchVenuesFromOverpass, geocodeOnServer } from "@/lib/overpass-server";

export const runtime = "nodejs";

/**
 * Find real venues near a place, for an admin to review and onboard.
 *
 * Source is OpenStreetMap via Overpass — the same source the venue map
 * already uses. It is openly licensed (ODbL, attribution required) and the
 * data is real: names, addresses, coordinates, phone numbers and opening
 * hours that somebody surveyed.
 *
 * Deliberately NOT Google Maps. Their place photos and place content are
 * licensed to Google, and copying them into our own database would breach
 * their terms however convenient it is.
 *
 * Nothing here is written. It returns candidates; the admin picks.
 */
export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not allowed." }, { status: 401 });

  // Admin-only: this hits a shared public API on our identity, so it is not
  // something an anonymous visitor gets to trigger.
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  if (adminErr || !isAdmin)
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const category = (url.searchParams.get("category") ?? "").trim();
  const radius = Math.min(
    30000,
    Math.max(1000, Number(url.searchParams.get("radius")) || 8000)
  );
  if (!q || !category)
    return NextResponse.json(
      { error: "q and category are required." },
      { status: 400 }
    );

  const place = await geocodeOnServer(q);
  if (!place)
    return NextResponse.json(
      { error: `Couldn't find "${q}" in Nigeria.` },
      { status: 404 }
    );

  let found;
  try {
    found = await fetchVenuesFromOverpass({
      lat: place.lat,
      lng: place.lng,
      category,
      radius,
    });
  } catch (e) {
    // Overpass rate-limits and times out under load. Say so rather than
    // returning an empty list, which reads as "there are no venues here".
    return NextResponse.json(
      {
        error:
          "OpenStreetMap didn't answer in time — it rate-limits. Try again in a minute.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 }
    );
  }

  // Drop anything already onboarded, matched on name so an admin doesn't
  // have to remember what they imported last week.
  const { data: existing } = await supabase.from("venues").select("name");
  const taken = new Set(
    (existing ?? []).map((v: { name: string }) => v.name.trim().toLowerCase())
  );

  const candidates = found
    .filter((v) => !taken.has(v.name.trim().toLowerCase()))
    .slice(0, 60);

  return NextResponse.json({
    place: place.label,
    category,
    total: found.length,
    alreadyOnboarded: found.length - candidates.length,
    candidates,
  });
}

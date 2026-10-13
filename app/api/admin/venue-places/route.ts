import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePlaceId } from "@/lib/google-places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fill in google_place_id for venues that do not have one.
 *
 * Run by an admin, in batches, once. Resolving a place id uses the ids-only
 * field mask, which Google bills at nothing, but it is still 304 round trips
 * so it is deliberately not something a page render does.
 *
 * Writes nothing but the id. Ratings and reviews are fetched live on the
 * venue page and never stored, which Google's terms require and which also
 * keeps the expensive call on pages somebody actually opened.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean | null }>();
  if (!me?.is_admin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY is not set on the server." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  // Small batches on purpose. A serverless function has a wall clock, and a
  // run that times out halfway through leaves no record of how far it got.
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 25));

  const { data: venues, error } = await supabase
    .from("venues")
    .select("id, name, address, state")
    .is("google_place_id", null)
    .eq("is_active", true)
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { error: `Could not read venues: ${error.message}` },
      { status: 500 }
    );
  }

  let matched = 0;
  let missed = 0;
  const failures: string[] = [];

  for (const v of (venues ?? []) as {
    id: string;
    name: string;
    address: string | null;
    state: string | null;
  }[]) {
    const placeId = await resolvePlaceId(v.name, v.address, v.state);
    if (!placeId) {
      missed++;
      continue;
    }
    const { error: upErr } = await supabase
      .from("venues")
      .update({ google_place_id: placeId })
      .eq("id", v.id);
    if (upErr) failures.push(`${v.name}: ${upErr.message}`);
    else matched++;
  }

  // A venue Google has never heard of stays null and will be tried again on
  // the next run. That is cheap and harmless: the search is free, and a new
  // bar that opened last month may well be on Google next quarter.
  return NextResponse.json({
    looked_at: venues?.length ?? 0,
    matched,
    not_found: missed,
    failures,
    remaining_hint:
      (venues?.length ?? 0) === limit
        ? "Full batch. Run again for the next one."
        : "That was the last batch.",
  });
}

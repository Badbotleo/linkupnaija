import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import VenueDetail from "@/components/venues/VenueDetail";
import OnboardedVenue, {
  type OnboardedVenueData,
} from "@/components/venues/OnboardedVenue";

export const dynamic = "force-dynamic";

/**
 * The venue's own name in the tab and in search results.
 *
 * A static "Venue" meant 257 onboarded places all shared one title, which is
 * the shape Google reads as one page rather than 257. OSM venues keep the
 * generic one: their names come from a live API, and blocking the document
 * head on Overpass to title a page is a bad trade.
 */
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  if (UUID.test(params.id)) {
    const { data } = await createClient()
      .from("venues")
      .select("name, category, state, description")
      .eq("id", params.id)
      .eq("is_active", true)
      .maybeSingle();
    const v = data as {
      name: string;
      category: string;
      state: string | null;
      description: string | null;
    } | null;
    if (v) {
      return {
        title: v.name,
        description:
          v.description?.slice(0, 155) ??
          `${v.category} in ${v.state ?? "Nigeria"}. Request a reservation through LinkUpNaija.`,
        alternates: { canonical: `/venues/${params.id}` },
      };
    }
  }
  return {
    title: "Venue",
    description: "Venue details and reservations on LinkUpNaija.",
  };
}

/**
 * OpenStreetMap ids look like node-12345. Ours are UUIDs.
 *
 * This page only ever resolved the first kind, so every link to a venue we
 * had onboarded ended at "Venue not found" — including the "See the venue"
 * link on every slide of the venue reel. /api/venues/detail validates
 * ^(node|way|relation)-\d+$ and answers 400 to anything else, so a UUID was
 * not a miss, it was a rejection.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VenuePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (UUID.test(params.id)) {
    const { data: venue } = await supabase
      .from("venues")
      .select(
        "id, name, category, address, state, description, phone, website, price_range, rating, rating_count, opening_hours, image_url, gallery_urls, lat, lng"
      )
      .eq("id", params.id)
      .eq("is_active", true)
      .maybeSingle();

    if (venue) {
      // Claims are readable only by their claimant or an admin, so this
      // returns this viewer's own claim and nothing else.
      const { data: mine } = user
        ? await supabase
            .from("venue_owners")
            .select("status")
            .eq("venue_id", params.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : { data: null };

      // Whether anybody owns it is a different question, and the answer has
      // to come from somewhere the policy allows. owns_venue() is about the
      // caller, so this asks the venue instead.
      //
      // A missing function is not an error worth a broken page. supabase-js
      // returns { data: null, error } rather than throwing, and null is
      // treated as "nobody owns it", which shows the claim invitation to
      // somebody who cannot use it rather than showing a stranger an error.
      // That is the right way round while the migration is catching up, and
      // it costs one wasted claim at worst.
      const { data: takenBy, error: takenErr } = await supabase.rpc(
        "venue_is_claimed",
        { p_venue: params.id }
      );
      if (takenErr) {
        console.warn(
          "venue_is_claimed unavailable, treating venue as unclaimed:",
          takenErr.message
        );
      }

      const v = venue as unknown as OnboardedVenueData;
      return (
        <div>
          <AppHeader title={v.name} subtitle={v.category} back />
          <div className="container-page py-5">
            <OnboardedVenue
              venue={{ ...v, gallery_urls: v.gallery_urls ?? [] }}
              isLoggedIn={!!user}
              claimStatus={(mine as { status?: string } | null)?.status ?? null}
              claimedByAnother={
                takenBy === true &&
                (mine as { status?: string } | null)?.status !== "approved"
              }
            />
          </div>
        </div>
      );
    }
    // Falls through to the OSM view, which renders its own not-found.
  }

  return (
    <div>
      <AppHeader title="Venue" subtitle="Details and reservations" back />
      <div className="container-page py-5">
        <VenueDetail id={params.id} isLoggedIn={!!user} />
      </div>
    </div>
  );
}

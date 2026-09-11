import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import ManageVenue from "@/components/venues/ManageVenue";
import type { OnboardedVenueData } from "@/components/venues/OnboardedVenue";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manage venue",
  // Nobody should find this in a search result: it is one person's admin
  // screen for one business, and it is behind an ownership check anyway.
  robots: { index: false, follow: false },
};

/**
 * The owner's side of a venue.
 *
 * Guarded twice on purpose. This check decides whether the page renders, and
 * RLS decides whether the writes land — so a stale tab, a revoked claim or a
 * hand-typed URL all fail at the database even if something here were wrong.
 * The page check exists to give a person a sentence instead of a silent
 * failure; it is not what makes this safe.
 */
export default async function ManageVenuePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/venues/${params.id}/manage`);

  const { data: claim } = await supabase
    .from("venue_owners")
    .select("status")
    .eq("venue_id", params.id)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();

  // Straight back to the venue rather than an error page. Somebody here
  // without an approved claim is almost always the person who just sent one,
  // and the venue page is where its status is shown.
  if (!claim) redirect(`/venues/${params.id}`);

  const { data: venue } = await supabase
    .from("venues")
    .select(
      "id, name, category, address, state, description, phone, website, price_range, rating, rating_count, opening_hours, image_url, gallery_urls, lat, lng"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!venue) redirect("/venues");

  const v = venue as unknown as OnboardedVenueData;

  return (
    <div>
      <AppHeader title={v.name} subtitle="Your venue" back />
      <div className="container-page py-5">
        <ManageVenue venue={{ ...v, gallery_urls: v.gallery_urls ?? [] }} />
      </div>
    </div>
  );
}

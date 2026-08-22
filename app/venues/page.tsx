import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import VenuesExplorer from "@/components/venues/VenuesExplorer";
import { getVisitorState } from "@/lib/visitor-geo";
import { scopeState } from "@/lib/geo-scope";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Venues",
  description:
    "Discover clubs, restaurants, cinemas, parks and more across Nigeria, then request a reservation through LinkUpNaija.",
};

export default async function VenuesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Same rule as the events feed: a Lagos visitor is shown Lagos venues. A
  // partner club in Abuja is not a place a Lagos user can book tonight, and
  // the partner list was national regardless of where anyone was standing.
  // Sparse states still see everything — see lib/geo-scope.
  const scope = scopeState({ visitorState: getVisitorState() });

  return (
    <div>
      <AppHeader
        title={"Venues"}
        subtitle={<>Find the perfect spot for your next link-up</>}
      />
      <div className="container-page py-5">

      <div>
        <VenuesExplorer isLoggedIn={!!user} stateScope={scope} />
      </div>
      </div>
    </div>
  );
}

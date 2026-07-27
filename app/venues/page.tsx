import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import VenuesExplorer from "@/components/venues/VenuesExplorer";

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

  return (
    <div>
      <AppHeader
        title={"Venues"}
        subtitle={<>Find the perfect spot for your next link-up</>}
      />
      <div className="container-page py-5">

      <div>
        <VenuesExplorer isLoggedIn={!!user} />
      </div>
      </div>
    </div>
  );
}

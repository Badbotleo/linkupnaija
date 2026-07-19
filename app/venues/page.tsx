import PageHero, { Gold } from "@/components/PageHero";
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
      <PageHero
        watermark="Venues"
        title={<>Discover <Gold>venues</Gold></>}
        subtitle="Find the perfect spot for your next link-up, powered by OpenStreetMap."
      />
      <div className="container-page py-8">

      <div className="mt-8">
        <VenuesExplorer isLoggedIn={!!user} />
      </div>
      </div>
    </div>
  );
}

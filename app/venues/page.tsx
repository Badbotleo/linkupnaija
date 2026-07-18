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
    <div className="container-page py-10">
      <h1 className="text-3xl font-extrabold text-gray-900">Discover venues</h1>
      <p className="mt-1 text-gray-600">
        Find the perfect spot for your next link-up, powered by OpenStreetMap.
      </p>

      <div className="mt-8">
        <VenuesExplorer isLoggedIn={!!user} />
      </div>
    </div>
  );
}

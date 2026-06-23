import { createClient } from "@/lib/supabase/server";
import VenueDetail from "@/components/venues/VenueDetail";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Venue",
  description: "Venue details and reservations on LinkUpNaija.",
};

export default async function VenuePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="container-page py-10">
      <VenueDetail id={params.id} isLoggedIn={!!user} />
    </div>
  );
}

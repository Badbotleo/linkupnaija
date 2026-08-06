import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import DriverOnboarding from "@/components/rides/DriverOnboarding";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Drive with LinkUpNaija",
  description:
    "Sign up to drive with LinkUpNaija. Upload your photo, ID and vehicle details and start earning on rides to events near you.",
};

export default async function DrivePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/drive");

  // The table lands with migration-drivers.sql. Until it's run the query
  // errors, and a missing table should read as "not applied yet" rather than
  // crashing the page.
  const { data: existing } = await supabase
    .from("drivers")
    .select(
      "id, status, admin_notes, full_name, phone, photo_url, id_type, id_number, licence_expiry, vehicle_make, vehicle_model, vehicle_colour, vehicle_year, plate_number, vehicle_photo_url, seats, state, city"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("users")
    .select("name, phone, state")
    .eq("id", user.id)
    .single<{ name: string | null; phone: string | null; state: string | null }>();

  return (
    <div>
      <AppHeader
        title="Drive with LinkUpNaija"
        subtitle="Earn on rides to link-ups near you"
        back
      />
      <div className="container-page max-w-2xl py-5">
        <DriverOnboarding
          userId={user.id}
          existing={existing ?? null}
          defaults={{
            full_name: profile?.name ?? "",
            phone: profile?.phone ?? "",
            state: profile?.state ?? "",
          }}
        />
      </div>
    </div>
  );
}

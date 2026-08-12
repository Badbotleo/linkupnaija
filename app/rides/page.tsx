import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import RideHailer from "@/components/rides/RideHailer";
import DriverOnboarding from "@/components/rides/DriverOnboarding";
import RidesTabs from "@/components/rides/RidesTabs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rides",
  description:
    "Request a car to your next link-up. Sedans, SUVs, buses and luxury rides from vetted LinkUpNaija partners.",
};

export default async function RidesPage({
  searchParams,
}: {
  searchParams: { to?: string; event?: string; title?: string; tab?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=%2Frides");

  const drive = searchParams.tab === "drive";

  const { data: me } = await supabase
    .from("users")
    .select("state, phone, name")
    .eq("id", user.id)
    .single();

  // Only fetch the driver's application when that tab is open.
  const { data: existing } = drive
    ? await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <AppHeader
        title="Rides"
        subtitle={
          drive ? "Earn on rides to link-ups near you" : "Get a ride to your next link-up"
        }
        back
        meta={[
          { icon: "shield", label: "Vetted partners" },
          { icon: "check", label: "Fare before you pay" },
        ]}
      />
      <div className="mx-auto max-w-2xl px-4 sm:py-4">
        <Suspense fallback={null}>
          <RidesTabs />
        </Suspense>
      </div>

      {drive ? (
        <div className="container-page max-w-2xl py-5">
          <DriverOnboarding
            userId={user.id}
            existing={existing ?? null}
            defaults={{
              full_name: me?.name ?? "",
              phone: me?.phone ?? "",
              state: me?.state ?? "",
            }}
          />
        </div>
      ) : (
      <div className="mx-auto max-w-2xl sm:px-4 sm:py-4">
        <RideHailer
          meId={user.id}
          myPhone={me?.phone ?? null}
          presetTo={searchParams.to ?? null}
          presetEventTitle={searchParams.title ?? null}
        />

      </div>
      )}
    </div>
  );
}

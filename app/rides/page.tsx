import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import RideHailer from "@/components/rides/RideHailer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hail a car",
  description:
    "Request a car to your next link-up. Sedans, SUVs, buses and luxury rides from vetted LinkUpNaija partners.",
};

export default async function RidesPage({
  searchParams,
}: {
  searchParams: { to?: string; event?: string; title?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=%2Frides");

  const { data: me } = await supabase
    .from("users")
    .select("state, phone")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <AppHeader
        title="Hail a car"
        subtitle="Get a ride to your next link-up"
        back
        meta={[
          { icon: "shield", label: "Vetted partners" },
          { icon: "check", label: "Fare before you pay" },
        ]}
      />
      <div className="mx-auto max-w-2xl sm:px-4 sm:py-4">
        <RideHailer
          meId={user.id}
          myPhone={me?.phone ?? null}
          presetTo={searchParams.to ?? null}
          presetEventTitle={searchParams.title ?? null}
        />
      </div>
    </div>
  );
}

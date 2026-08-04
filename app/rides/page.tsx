import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
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
        action={
          <Link
            href="/drive"
            className="whitespace-nowrap rounded-full border border-brand/30 px-3.5 py-2 text-sm font-bold text-brand transition hover:bg-brand-50"
          >
            Drive
          </Link>
        }
      />
      <div className="mx-auto max-w-2xl sm:px-4 sm:py-4">
        <RideHailer
          meId={user.id}
          myPhone={me?.phone ?? null}
          presetTo={searchParams.to ?? null}
          presetEventTitle={searchParams.title ?? null}
        />

        {/* /drive existed with nothing pointing at it, so nobody could find
            the driver application. This is the entry point. */}
        <div className="px-4 pb-6 pt-2 sm:px-0">
          <Link
            href="/drive"
            className="surface-tap flex items-center gap-3 p-4"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">
              <LineIcon name="car" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-gray-900">
                Got a car? Drive with us
              </span>
              <span className="mt-0.5 block text-sm text-gray-500">
                Upload your ID and plate, get verified, start earning
              </span>
            </span>
            <LineIcon name="chevronRight" size={16} className="shrink-0 text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}

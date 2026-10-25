import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import RideHailer from "@/components/rides/RideHailer";
import DriverOnboarding from "@/components/rides/DriverOnboarding";
import OperatorOnboarding from "@/components/rides/OperatorOnboarding";
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
  searchParams: {
    to?: string;
    event?: string;
    title?: string;
    tab?: string;
    as?: string;
  };
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

  // Only fetch the applications when that tab is open.
  const { data: existing } = drive
    ? await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  // A company application, if this account has one. The table may not exist
  // until the operators migration has run, so a failure here must not take
  // the whole page down with it.
  const operator = drive
    ? (
        await supabase
          .from("operators")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle()
      ).data
    : null;

  // Which path they are on: their own car, or a fleet.
  const asCompany = searchParams.as === "company" || !!operator;
  const choosing = drive && !existing && !operator && !searchParams.as;

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
          {choosing ? (
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-gray-900">
                How do you want to earn?
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Both get the same rides. The difference is who we contract with
                and how you are paid.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link
                  href="/rides?tab=drive&as=driver"
                  className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand/40 hover:shadow-card"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand">
                    <LineIcon name="car" size={21} />
                  </span>
                  <h3 className="mt-3 font-extrabold text-gray-900">
                    I drive my own car
                  </h3>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-gray-600">
                    One person, one vehicle. We verify your ID and your car,
                    and riders see your name and face before you collect them.
                  </p>
                  <span className="mt-3 text-sm font-bold text-brand">
                    Sign up as a driver →
                  </span>
                </Link>

                <Link
                  href="/rides?tab=drive&as=company"
                  className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand/40 hover:shadow-card"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand">
                    <LineIcon name="briefcase" size={21} />
                  </span>
                  <h3 className="mt-3 font-extrabold text-gray-900">
                    I run a fleet
                  </h3>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-gray-600">
                    A registered company with several vehicles and drivers. We
                    contract with the business, and Paystack pays your fares
                    straight into the company account.
                  </p>
                  <span className="mt-3 text-sm font-bold text-brand">
                    Apply as a company →
                  </span>
                </Link>
              </div>

              <p className="mt-4 text-center text-xs text-gray-500">
                Not sure? Pick the one that matches whose name is on the vehicle
                papers.
              </p>
            </div>
          ) : asCompany ? (
            <OperatorOnboarding
              existing={operator ?? null}
              defaults={{
                business_name: "",
                phone: me?.phone ?? "",
                state: me?.state ?? "",
              }}
            />
          ) : (
            <DriverOnboarding
              userId={user.id}
              existing={existing ?? null}
              defaults={{
                full_name: me?.name ?? "",
                phone: me?.phone ?? "",
                state: me?.state ?? "",
              }}
            />
          )}
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

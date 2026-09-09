import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import PayoutSettings from "@/components/PayoutSettings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payout details" };

export default async function PayoutSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/edit/payouts");

  const { data: profile } = await supabase
    .from("users")
    .select("payout_bank, payout_account_number, payout_account_name")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <AppHeader
        title="Payout details"
        subtitle="Where your ticket money goes"
        back
      />
      <div className="container-page max-w-[640px] py-4">
        <PayoutSettings
          userId={user.id}
          initial={{
            payout_bank: profile?.payout_bank ?? null,
            payout_account_number: profile?.payout_account_number ?? null,
            payout_account_name: profile?.payout_account_name ?? null,
          }}
        />
      </div>
    </div>
  );
}

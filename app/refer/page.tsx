import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHero, { Gold } from "@/components/PageHero";
import ReferralCard from "@/components/referral/ReferralCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invite & earn",
  description:
    "Invite friends to LinkUpNaija and you both get ₦500 wallet credit.",
};

const STEPS = [
  {
    title: "Share your link",
    text: "Copy it or send it straight to the group chat on WhatsApp.",
  },
  {
    title: "Your friend joins",
    text: "They sign up with your link and verify their email.",
  },
  {
    title: "You both get ₦500",
    text: "Wallet credit lands instantly — spend it on any paid event.",
  },
];

export default async function ReferPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=%2Frefer");

  const [{ data: profile }, { data: referralRaw }] = await Promise.all([
    supabase.from("users").select("referral_code").eq("id", user.id).single(),
    supabase
      .from("referrals")
      .select(
        "reward_amount, status, referred:users!referrals_referred_id_fkey(name)"
      )
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const rows = (referralRaw ?? []) as unknown as {
    reward_amount: number | null;
    status: string;
    referred: { name: string | null } | null;
  }[];
  const totalEarned = rows.reduce((s, r) => s + (r.reward_amount ?? 0), 0);
  const referredNames = rows.map(
    (r) => (r.referred?.name ?? "A friend").split(" ")[0]
  );

  return (
    <div>
      <PageHero
        watermark="Invite"
        title={
          <>
            Bring your people, <Gold>get paid</Gold>
          </>
        }
        subtitle="Every friend who joins with your link earns you both ₦500 wallet credit."
      />
      <div className="container-page max-w-2xl py-8">
        <ReferralCard
          referralCode={profile?.referral_code ?? null}
          referralCount={rows.length}
          totalEarned={totalEarned}
          referredNames={referredNames}
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-sm font-extrabold text-brand">
                {i + 1}
              </span>
              <h2 className="mt-3 font-bold text-gray-900">{s.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

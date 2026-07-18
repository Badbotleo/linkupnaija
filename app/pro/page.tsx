import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@/lib/supabase/server";
import GoProButton from "@/components/GoProButton";
import { PRO_PRICE, FREE_REQUEST_LIMIT, isProActive } from "@/lib/pro";
import { formatNaira } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LinkUpNaija Pro",
  description:
    "Go Pro for ₦9,900/month: see who viewed your profile, early access to events, unlimited join requests, and a profile boost.",
};

const BENEFITS = [
  {
    icon: "eye",
    title: "See who viewed your profile",
    text: "Know who's checking you out and never miss a potential connection.",
  },
  {
    icon: "zap",
    title: "Early access to events",
    text: "Request to join events 24 hours before they go public.",
  },
  {
    icon: "infinity",
    title: "Unlimited join requests",
    text: `Free members can send ${FREE_REQUEST_LIMIT} join requests a month. Pro members get unlimited.`,
  },
  {
    icon: "trending",
    title: "Profile boost in search",
    text: "Your profile and requests rank higher so hosts notice you first.",
  },
  {
    icon: "star",
    title: "Gold Pro badge",
    text: "Stand out with a Pro badge on your profile that hosts trust.",
  },
];

export default async function ProPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let proActive = false;
  let expiresAt: string | null = null;
  if (user) {
    const { data: me } = await supabase
      .from("users")
      .select("is_pro, pro_expires_at")
      .eq("id", user.id)
      .single();
    proActive = isProActive(me?.is_pro, me?.pro_expires_at);
    expiresAt = me?.pro_expires_at ?? null;
  }

  return (
    <div className="container-page max-w-3xl py-14">
      <div className="text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-1 text-sm font-bold text-white">
          ★ LinkUpNaija Pro
        </span>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          Link up like a Pro
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Unlock the full LinkUpNaija experience for{" "}
          <span className="font-bold text-gray-900">
            {formatNaira(PRO_PRICE)}/month
          </span>
          .
        </p>
      </div>

      <div className="mt-10 space-y-3">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-500">
              <LineIcon name={b.icon} size={20} />
            </span>
            <div>
              <h3 className="font-bold text-gray-900">{b.title}</h3>
              <p className="mt-0.5 text-sm text-gray-600">{b.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-3xl bg-gradient-to-br from-brand to-brand-700 px-8 py-10 text-center text-white">
        <p className="text-4xl font-extrabold">
          {formatNaira(PRO_PRICE)}
          <span className="text-lg font-medium text-brand-100">/month</span>
        </p>
        <p className="mt-2 text-brand-100">Cancel anytime. Renews monthly.</p>
        <div className="mt-6 flex justify-center">
          <GoProButton
            isLoggedIn={!!user}
            isProActive={proActive}
            expiresAt={expiresAt}
          />
        </div>
      </div>
    </div>
  );
}

import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@/lib/supabase/server";
import GoProButton from "@/components/GoProButton";
import { PRO_PRICE, FREE_REQUEST_LIMIT, FREE_HOST_LIMIT, isProActive } from "@/lib/pro";
import { formatNaira } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LinkUpNaija Pro",
  description:
    "₦4,999/month — less than one ticket to most events on here. Host unlimited link-ups, get in 24 hours early, and send as many join requests as you like.",
};

const BENEFITS = [
  {
    icon: "infinity",
    title: "Host as many link-ups as you want",
    text: `Free members host ${FREE_HOST_LIMIT} a month. Pro is unlimited — run a weekly night without ever hitting a wall.`,
  },
  {
    icon: "zap",
    title: "Get in 24 hours before everyone else",
    text: "Request to join events a full day before they go public. On a link-up that fills, that's the difference between going and reading about it.",
  },
  {
    icon: "infinity",
    title: "Unlimited join requests",
    text: `Free members send ${FREE_REQUEST_LIMIT} a month. Pro members never count.`,
  },
  {
    icon: "trending",
    title: "Hosts see you first",
    text: "Your requests rank higher in a host's queue, which matters most on the events everyone wants.",
  },
  {
    icon: "eye",
    title: "See who viewed your profile",
    text: "Know who's been looking, and follow up before the moment passes.",
  },
  {
    icon: "star",
    title: "Gold Pro badge",
    text: "A badge on your profile that tells a host you're a regular, not a stranger.",
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
    <div>
      <AppHeader
        title={"LinkUpNaija Pro"}
        subtitle={<>Stand out, see more, get in first</>}
        back
      />
      <div className="container-page max-w-3xl py-10">

      {/* Price first.

          The page used to make you scroll past six benefit cards before it
          said what it cost, which is the wrong order: nobody evaluates
          features before they know the number, they just wonder what the
          catch is.

          The comparison is real and checkable, not a slogan — the median
          ticket on this platform is ₦10,000 and 40 of the 50 paid events cost
          more than Pro does. */}
      <div className="rounded-3xl bg-gradient-to-br from-brand to-brand-700 px-6 py-8 text-center text-white sm:px-8">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-100">
          LinkUpNaija Pro
        </p>
        <p className="mt-2 text-5xl font-extrabold leading-none">
          {formatNaira(PRO_PRICE)}
          <span className="text-lg font-medium text-brand-100">/month</span>
        </p>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-snug text-brand-100">
          Less than one ticket to most events on here — 8 out of 10 paid
          link-ups cost more than a month of Pro.
        </p>
        <div className="mt-6 flex justify-center">
          <GoProButton
            isLoggedIn={!!user}
            isProActive={proActive}
            expiresAt={expiresAt}
          />
        </div>
        <p className="mt-3 text-[13px] text-brand-100">
          Cancel anytime. Renews monthly.
        </p>
      </div>

      <div className="mt-8 space-y-3">
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

      {/* A second chance to act after reading the list, without repeating the
          whole price slab — the same panel twice reads as a page that's run
          out of things to say. */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <GoProButton
          isLoggedIn={!!user}
          isProActive={proActive}
          expiresAt={expiresAt}
        />
        <p className="text-[13px] text-gray-500">
          {formatNaira(PRO_PRICE)}/month · cancel anytime
        </p>
      </div>
      </div>
    </div>
  );
}

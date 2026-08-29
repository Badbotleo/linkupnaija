import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@/lib/supabase/server";
import GoProButton from "@/components/GoProButton";
import {
  PRO_PRICE,
  FREE_HOST_LIMIT,
  PLATFORM_FEE_PERCENT,
  PRO_PLATFORM_FEE_PERCENT,
  isProActive,
} from "@/lib/pro";
import { formatNaira } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LinkUpNaija Pro",
  description:
    "₦4,999/month. Keep 95% of every ticket you sell instead of 90%, host without a limit, and get in 24 hours before everyone else.",
};

/**
 * Only what the code actually does. Everything here is enforced somewhere:
 * the fee in a trigger on `transactions`, the queue order in ManageRequests,
 * the early window in a trigger on `rsvps`.
 *
 * The fee leads, because it is the only line that pays for itself rather than
 * feeling nice. Every other benefit asks the reader to value convenience at
 * 4,999 a month; this one hands them a sum they can check against their last
 * event. A host who sells any real volume is now losing money by NOT paying,
 * which is a much easier thing to sell than a badge.
 *
 * The limits are quoted as what they cost you, not as what the tier grants.
 * "2 a month" means nothing until somebody works out it stops a weekly night
 * in its second week, so the copy does that sum for them.
 */
const BENEFITS = [
  {
    icon: "ticket",
    title: "Half the fee on every ticket",
    text: `Free hosts give up ${PLATFORM_FEE_PERCENT}% of a sale. Pro gives up ${PRO_PLATFORM_FEE_PERCENT}%. Sell twenty ₦10,000 tickets and the half you keep is ₦10,000 back in one night, against ₦${PRO_PRICE.toLocaleString(
      "en-NG"
    )} for the month.`,
  },
  {
    icon: "infinity",
    title: "Host without a ceiling",
    text: `Free members host ${FREE_HOST_LIMIT} link-ups a month, which stops a weekly night in its second week. Pro has no limit.`,
  },
  {
    icon: "zap",
    title: "First in the queue",
    text: "A host works down their requests and often stops before the bottom. Pro sits at the top of that list, which matters most on the link-ups everyone wants.",
  },
  {
    icon: "clock",
    title: "24 hours before everyone else",
    text: "When a host sets a time for requests to open, Pro can ask a full day early. On a link-up that fills, that is the difference between going and reading about it.",
  },
  {
    icon: "eye",
    title: "See who looked you up",
    text: "Hosts read your profile before they approve you, and so do people from the group chat. Pro shows you who has been looking.",
  },
  {
    icon: "star",
    title: "The gold badge",
    text: "A host working through a queue of strangers can see at a glance that you are a regular here, not a name they have never met.",
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
          Less than one ticket to most events on here. 8 out of 10 paid
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

import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import ProBadge from "@/components/ProBadge";
import { createClient } from "@/lib/supabase/server";
import GoProButton from "@/components/GoProButton";
import VerifyIdCard from "@/components/premium/VerifyIdCard";
import { PRO_PRICE, FREE_HOST_LIMIT, isProActive } from "@/lib/pro";
import { formatNaira } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LinkUpNaija Premium",
  description:
    "₦4,999/month. Get the gold verified badge, ask to join a full day early, sit at the top of the host's queue, and host without a limit.",
  alternates: { canonical: "/premium" },
};

/**
 * Premium, renamed from Pro on 2 Sep 2026 and rebuilt around the badge.
 *
 * The old page led on money: half the platform fee. That benefit died when
 * the booking fee moved onto the buyer, since hosts now keep 100% either way,
 * and what was left was a list of conveniences nobody values at ₦4,999.
 *
 * The badge leads instead, for a reason particular to this product. Every
 * transaction here starts with a stranger asking to enter a room, often
 * somebody's home, and a host deciding yes or no with almost nothing to go
 * on. Anything that shortens that decision is worth real money to both sides.
 * A badge is not a vanity item on a platform built on approval; it is the
 * thing being approved.
 *
 * WHICH ONLY WORKS IF IT VERIFIES SOMETHING. A gold seal that means "paid"
 * is a lie, and hosts would work that out inside a month, at which point it
 * is worth less than no badge and it has taken the platform's credibility
 * with it. So the badge is granted after a person on the team checks the
 * member, using the admin_set_pro path that already exists. At this size that
 * review is a few minutes of work, and being small is exactly what makes an
 * honest version possible: it is a real check because somebody really does it.
 *
 * The copy below therefore says what the badge certifies, and never implies a
 * check that has not happened.
 */

/**
 * Named capabilities, X-style, not sentences about how nice they are.
 *
 * The previous list read "Ask a full day early", "Top of the host's queue":
 * descriptions of an experience. X Premium sells "Verified checkmark", "Reply
 * prioritization", "Longer posts" — a list of things you GET, each with a
 * short line underneath. It scans in three seconds and every item sounds like
 * a switch being flipped, because it is.
 *
 * Same discipline as everywhere else on this page: nothing here is listed
 * that the code does not do.
 */
const FEATURES = [
  {
    icon: "star",
    name: "Gold verified badge",
    line: "Checked by a person against a government ID, not granted by a payment.",
    lead: true,
  },
  {
    icon: "trending",
    name: "A free boost every month",
    line: "One 48-hour boost included, worth ₦5,000. Premium costs ₦4,999.",
  },
  {
    icon: "clock",
    name: "Early access",
    line: "Ask to join 24 hours before requests open to everyone.",
  },
  {
    icon: "zap",
    name: "Priority in the queue",
    line: "Your request sits at the top of the host's list, not the bottom.",
  },
  {
    icon: "infinity",
    name: "Unlimited hosting",
    line: `No ${FREE_HOST_LIMIT}-a-month ceiling.`,
  },
  {
    icon: "trending",
    name: "Event analytics",
    line: "Who saw your link-up, who saved it, who turned up. Where the drop-off is.",
  },
  {
    icon: "eye",
    name: "Profile visitors",
    line: "See who looked you up before deciding about you.",
  },
];

export default async function PremiumPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let proActive = false;
  let expiresAt: string | null = null;
  // Read defensively: id_verifications only exists once
  // migration-id-verification.sql has run, and a missing table must not take
  // the pricing page down with it.
  let idStatus: "none" | "pending" | "approved" | "rejected" = "none";
  let idNote: string | null = null;

  if (user) {
    const { data: me } = await supabase
      .from("users")
      .select("is_pro, pro_expires_at")
      .eq("id", user.id)
      .single();
    proActive = isProActive(me?.is_pro, me?.pro_expires_at);
    expiresAt = me?.pro_expires_at ?? null;

    const { data: v } = await supabase
      .from("id_verifications")
      .select("status, note")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (v?.status === "pending" || v?.status === "approved" || v?.status === "rejected") {
      idStatus = v.status;
      idNote = v.note ?? null;
    }
  }

  return (
    <div>
      <AppHeader
        title="LinkUpNaija Premium"
        subtitle="Get verified, and get in first"
        back
      />

      <div className="container-page max-w-[720px] py-4">
        {/* The badge, at the size it is worth. Everything else on this page
            is a supporting argument for this one object. */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A1040] via-brand-800 to-brand-700 px-6 py-9 text-center">
          <div className="flex justify-center">
            <ProBadge size={76} />
          </div>
          <h2 className="mx-auto mt-5 max-w-[16ch] text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white">
            The gold badge, and the check behind it
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-snug text-white/75">
            Every link-up here starts with a host deciding whether to let a
            stranger in. The badge tells them somebody at LinkUpNaija has
            checked you first.
          </p>

          <p className="mt-6 text-[40px] font-extrabold leading-none text-white">
            {formatNaira(PRO_PRICE)}
            <span className="text-base font-medium text-white/70">/month</span>
          </p>

          <div className="mt-5 flex justify-center">
            <GoProButton
              isLoggedIn={!!user}
              isProActive={proActive}
              expiresAt={expiresAt}
            />
          </div>
          <p className="mt-3 text-[13px] text-white/65">
            Cancel anytime. Renews monthly.
          </p>
        </section>

        {/* The submission sits directly under the price, for subscribers.
            The badge is the thing being sold, so the step that earns it
            cannot be somewhere else on the site. */}
        {user && proActive && (
          <div className="mt-4">
            <VerifyIdCard
              userId={user.id}
              initialStatus={idStatus}
              note={idNote}
            />
          </div>
        )}

        {/* What the seal actually certifies.
            Written plainly and kept short, because the moment this reads like
            legal cover the badge stops being reassuring. */}
        <h2 className="mb-2 mt-7 text-[13px] font-bold uppercase tracking-[0.12em] text-gray-400">
          What the badge means
        </h2>
        <div className="divide-y divide-gray-200/70 overflow-hidden rounded-2xl bg-white shadow-[var(--e1)] dark:divide-white/10 dark:bg-white/[0.04]">
          <Row
            icon="check"
            title="A person checked you, not a script"
            body="Somebody on the LinkUpNaija team reviews your account before the badge appears. It is not granted the moment a payment clears."
          />
          <Row
            icon="shield"
            title="It can be taken away"
            body="A badge that survives anything certifies nothing. Upheld reports remove it, and the subscription does not buy it back."
          />
          <Row
            icon="users"
            title="Hosts see it while deciding"
            body="It sits beside your name in a host's request queue, on your profile, and everywhere you appear. That is the moment it is worth having."
          />
        </div>

        <h2 className="mb-2 mt-7 text-[13px] font-bold uppercase tracking-[0.12em] text-gray-400">
          What you get
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.name}
              className={`rounded-2xl bg-white p-4 shadow-[var(--e1)] dark:bg-white/[0.04] ${
                f.lead ? "ring-1 ring-amber-400/40 sm:col-span-2" : ""
              }`}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/[0.16] text-amber-600"
                aria-hidden
              >
                <LineIcon name={f.icon} size={17} />
              </span>
              <p className="mt-2.5 text-[16px] font-extrabold tracking-[-0.01em] text-gray-900 dark:text-white">
                {f.name}
              </p>
              <p className="mt-1 text-[13.5px] leading-snug text-gray-600 dark:text-white/70">
                {f.line}
              </p>
            </div>
          ))}
        </div>

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

function Row({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <span
        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/[0.16] text-amber-600"
        aria-hidden
      >
        <LineIcon name={icon} size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-gray-900 dark:text-white">
          {title}
        </p>
        <p className="mt-1 text-[14px] leading-snug text-gray-600 dark:text-white/70">
          {body}
        </p>
      </div>
    </div>
  );
}

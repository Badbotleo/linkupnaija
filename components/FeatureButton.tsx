"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  payWithPaystack,
  isPaystackConfigured,
  formatNaira,
} from "@/lib/paystack";
import { confettiCoins } from "@/lib/confetti";

const FEATURE_PRICE = 5000; // ₦5,000 for 48 hours
const FEATURE_HOURS = 48;

export default function FeatureButton({
  eventId,
  alreadyFeatured,
}: {
  eventId: string;
  alreadyFeatured: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Whether this host may boost at all.
   *
   * Boosting is Premium-only, the way X gates ads. This only decides what the
   * button SAYS: the rule itself is a trigger on events, because this
   * component writes events.featured from the browser and a check that lives
   * in the UI is a check anyone can post around.
   *
   * Null while unknown, so the button does not flash a price at somebody who
   * is about to be told they cannot buy it.
   */
  const [canBoost, setCanBoost] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc("can_boost").then(({ data, error }) => {
      // A missing function means migration-premium-boost.sql has not run yet.
      // Assume allowed, so an un-migrated deploy behaves as it did before
      // rather than locking every host out of a feature they already had.
      if (alive) setCanBoost(error ? true : data === true);
    });
    return () => {
      alive = false;
    };
  }, [supabase]);

  if (alreadyFeatured) {
    return (
      <div className="rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 text-center text-sm font-semibold text-amber-700">
        ★ Your event is boosted
      </div>
    );
  }

  async function feature() {
    setError(null);
    if (!isPaystackConfigured()) {
      setError("Payments aren't configured yet.");
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        setError("Please log in again.");
        setLoading(false);
        return;
      }

      const result = await payWithPaystack({
        email: user.email,
        amountNaira: FEATURE_PRICE,
        metadata: { purpose: "feature_event", eventId },
      });
      if (!result) {
        setLoading(false); // user closed the popup
        return;
      }

      const until = new Date(
        Date.now() + FEATURE_HOURS * 60 * 60 * 1000
      ).toISOString();
      const { error } = await supabase
        .from("events")
        .update({ featured: true, featured_until: until })
        .eq("id", eventId);
      if (error) {
        setError(error.message);
      } else {
        confettiCoins();
        await supabase.from("event_boosts").insert({
          host_id: user.id,
          event_id: eventId,
          paid: true,
          amount: FEATURE_PRICE,
        });
        await supabase.from("notifications").insert({
          user_id: user.id,
          event_id: eventId,
          message:
            "Your event has been boosted 🚀 It's now featured for 48 hours",
        });
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    }
    setLoading(false);
  }

  // Boosting is Premium-only. Saying so, with the way out, beats a button
  // that takes a tap and then fails.
  if (canBoost === false) {
    return (
      <div className="rounded-xl border border-amber-300/60 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 dark:border-amber-400/25 dark:from-amber-400/10 dark:to-yellow-400/10">
        <p className="text-[15px] font-bold text-gray-900 dark:text-white">
          Boosting is a Premium feature
        </p>
        <p className="mt-1 text-[13.5px] leading-snug text-gray-600 dark:text-white/70">
          Put this event at the top of the feed for 48 hours. Premium members
          can buy a boost for {formatNaira(FEATURE_PRICE)}.
        </p>
        <Link href="/premium" className="btn-primary mt-3 inline-flex py-2 text-sm">
          See Premium
        </Link>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={feature}
        disabled={loading}
        className="btn w-full border border-amber-300 bg-gradient-to-r from-amber-400 to-yellow-500 text-white hover:opacity-90"
      >
        {loading
          ? "Processing…"
          : `★ Boost this event for 48 hours · ${formatNaira(FEATURE_PRICE)}`}
      </button>
      <p className="mt-1.5 text-center text-xs text-gray-400">
        Boosted events show at the top of the feed.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

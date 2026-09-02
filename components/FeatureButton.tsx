"use client";

import { useEffect, useState } from "react";
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
   * Whether this host still has this month's free Premium boost.
   *
   * Asked of the database rather than worked out here: the client knows
   * whether somebody is Premium but not whether they already spent it, and a
   * count kept in the browser is a count a host can edit.
   *
   * Null while unknown, so the button says nothing about price until it does.
   * Flashing "Free" and then charging ₦5,000 is worse than a beat of silence.
   */
  const [freeAvailable, setFreeAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc("free_boost_available").then(({ data, error }) => {
      // A missing function means migration-premium-boost.sql has not run.
      // Fall back to the paid path rather than breaking the button.
      if (alive) setFreeAvailable(error ? false : data === true);
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

  /** The Premium allowance. One database call does the whole thing. */
  async function claimFree() {
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.rpc("claim_free_boost", {
      p_event: eventId,
    });
    setLoading(false);

    // The function returns false when it refuses, rather than throwing, so
    // treating "no error" as success would boost nothing and say it worked.
    if (error || data !== true) {
      setFreeAvailable(false);
      setError(
        error?.message ??
          "That free boost is no longer available. You can still boost for ₦5,000."
      );
      return;
    }
    confettiCoins();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        event_id: eventId,
        message:
          "Your event has been boosted 🚀 It's featured for 48 hours, on your Premium allowance",
      });
    }
    router.refresh();
  }

  async function feature() {
    setError(null);
    if (freeAvailable) {
      await claimFree();
      return;
    }
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
          : freeAvailable
            ? "★ Boost this event for 48 hours · Free with Premium"
            : freeAvailable === null
              ? "★ Boost this event for 48 hours"
              : `★ Boost this event for 48 hours · ${formatNaira(FEATURE_PRICE)}`}
      </button>
      <p className="mt-1.5 text-center text-xs text-gray-400">
        Boosted events show at the top of the feed.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

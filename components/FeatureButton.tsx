"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  payWithPaystack,
  isPaystackConfigured,
  formatNaira,
} from "@/lib/paystack";

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
      if (error) setError(error.message);
      else router.refresh();
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
          : `★ Boost this event for 48 hours — ${formatNaira(FEATURE_PRICE)}`}
      </button>
      <p className="mt-1.5 text-center text-xs text-gray-400">
        Boosted events show at the top of the feed.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

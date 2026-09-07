"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  payWithPaystack,
  isPaystackConfigured,
  formatNaira,
} from "@/lib/paystack";
import { PRO_PRICE, PRO_DAYS } from "@/lib/pro";
import { confettiCoins } from "@/lib/confetti";

export default function GoProButton({
  isLoggedIn,
  isProActive,
  expiresAt,
}: {
  isLoggedIn: boolean;
  isProActive: boolean;
  expiresAt: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <a href="/login?redirect=/pro" className="btn-primary w-full sm:w-auto">
        Log in to get Premium
      </a>
    );
  }

  if (isProActive) {
    return (
      <div className="rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 px-5 py-4 text-center">
        <p className="font-bold text-amber-700">★ You&apos;re a Premium member</p>
        {expiresAt && (
          <p className="mt-0.5 text-sm text-amber-600">
            Renews / expires on{" "}
            {new Date(expiresAt).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    );
  }

  async function goPro() {
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
        amountNaira: PRO_PRICE,
        metadata: { purpose: "pro_subscription", userId: user.id },
      });
      if (!result) {
        setLoading(false); // user closed the popup
        return;
      }

      const expires = new Date(
        Date.now() + PRO_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      const { error } = await supabase
        .from("users")
        .update({ is_pro: true, pro_expires_at: expires })
        .eq("id", user.id);
      if (error) {
        setError(error.message);
      } else {
        confettiCoins();

        // The payment leaves a record.
        //
        // This flow used to take ₦4,999, flip is_pro and throw the Paystack
        // reference away, so the only evidence a subscription had been paid
        // for was a receipt in somebody's inbox. Written after the flag, not
        // before: a member who paid must end up Premium even if this insert
        // fails, and a ledger row without access is the better failure.
        //
        // Not awaited into the happy path either. If the table is missing
        // because migration-premium-payments.sql has not run, a subscriber
        // should still get what they paid for.
        const { error: ledgerError } = await supabase
          .from("premium_payments")
          .insert({
            user_id: user.id,
            amount: PRO_PRICE,
            paystack_reference: result.reference,
            expires_at: expires,
          });
        if (ledgerError) {
          console.error("Premium payment not recorded:", ledgerError.message);
        }

        await supabase.from("notifications").insert({
          user_id: user.id,
          message:
            "Welcome to Premium ⭐ Boost an event, see your analytics, and host as often as you like",
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
        onClick={goPro}
        disabled={loading}
        className="btn w-full border border-amber-300 bg-gradient-to-r from-amber-400 to-yellow-500 px-6 py-3 text-base text-white hover:opacity-90 sm:w-auto"
      >
        {loading ? "Processing…" : `★ Get Premium · ${formatNaira(PRO_PRICE)}/month`}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

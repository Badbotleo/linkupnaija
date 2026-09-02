"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatNaira } from "@/lib/paystack";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-naija-100 text-naija-700",
  declined: "bg-red-100 text-red-700",
};

export default function PayoutRequest({
  hostId,
  eventId,
  eventTitle,
  collected,
  platformFee,
  due,
  unrecorded = 0,
  status,
  phoneVerified = true,
}: {
  hostId: string;
  eventId: string;
  eventTitle: string;
  collected: number;
  platformFee: number;
  due: number;
  /** Guests who paid but whose transaction never landed. */
  unrecorded?: number;
  status: string | null;
  /**
   * Gate for money leaving the platform.
   *
   * Verification is deliberately NOT asked for at signup — most members never
   * touch a payout, and an SMS per signup is a bill for nothing. It's asked
   * for here, where a real number is the difference between paying a host and
   * paying whoever typed their name.
   *
   * Defaults true so an existing caller that hasn't been updated can't
   * accidentally lock hosts out of their own money.
   */
  phoneVerified?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [current, setCurrent] = useState<string | null>(status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request() {
    if (!phoneVerified) {
      setError(
        "Verify your phone number before requesting a payout — we need a real number to reach you about the transfer."
      );
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.from("payouts").insert({
      host_id: hostId,
      event_id: eventId,
      amount: due,
      platform_fee: platformFee,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setCurrent("pending");
      router.refresh();
    }
  }

  return (
    <div className="surface p-4">
      <p className="font-bold text-gray-900">{eventTitle}</p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <dt className="text-xs text-gray-400">Collected</dt>
          <dd className="font-semibold text-gray-900">
            {formatNaira(collected)}
          </dd>
        </div>
        <div>
          {/* Derived, not hardcoded. The rate has changed twice and legacy
              rows keep the one they were sold under, so a fixed label would
              contradict the figure printed beneath it. */}
          <dt className="text-xs text-gray-400">
            {collected > 0
              ? `Fee (${Math.round((platformFee / collected) * 100)}%)`
              : "Fee"}
          </dt>
          <dd className="font-semibold text-gray-900">
            {formatNaira(platformFee)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">You get</dt>
          <dd className="font-semibold text-brand">{formatNaira(due)}</dd>
        </div>
      </dl>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* Money left the guest's account but no transaction landed, so it isn't
          in the figures above. Silence here means a host waits for a payout
          that was never going to come. */}
      {unrecorded > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <strong>{unrecorded}</strong> guest{unrecorded === 1 ? "" : "s"} paid for
          this event but the payment didn&apos;t record, so it isn&apos;t counted
          above. Email support@linkupnaija.com and we&apos;ll reconcile it
          against Paystack.
        </p>
      )}

      <div className="mt-3">
        {current ? (
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-bold capitalize ${
              STATUS_STYLES[current] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            Payout {current}
          </span>
        ) : (
          <button
            type="button"
            onClick={request}
            disabled={loading || due <= 0}
            className="btn-primary w-full py-2"
          >
            {loading ? "Requesting…" : "Request payout"}
          </button>
        )}
      </div>
    </div>
  );
}

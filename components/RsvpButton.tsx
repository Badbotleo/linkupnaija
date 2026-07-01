"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { payWithPaystack, formatNaira } from "@/lib/paystack";
import { FREE_REQUEST_LIMIT } from "@/lib/pro";
import { confettiJoin, confettiCoins } from "@/lib/confetti";
import { toast } from "@/lib/toast";
import type { RsvpStatus } from "@/lib/types";

type JoinState = "none" | RsvpStatus;

export default function RsvpButton({
  eventId,
  isLoggedIn,
  initialStatus,
  isHost,
  isFull,
  price,
  isPro,
  requestsThisMonth,
  eventTitle,
  hostSubaccount,
  walletBalance = 0,
}: {
  eventId: string;
  isLoggedIn: boolean;
  initialStatus: JoinState;
  isHost: boolean;
  isFull: boolean;
  price: number;
  isPro: boolean;
  requestsThisMonth: number;
  eventTitle: string;
  hostSubaccount: string | null;
  walletBalance?: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<JoinState>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(walletBalance > 0);

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?redirect=/events/${eventId}`}
        className="btn-primary w-full"
      >
        Log in to request
      </Link>
    );
  }

  // Hosts don't see a "you're hosting" card here — they use Manage Requests.
  if (isHost) {
    return null;
  }

  async function getUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=/events/${eventId}`);
      return null;
    }
    return user;
  }

  async function request() {
    setLoading(true);
    setError(null);
    const user = await getUser();
    if (!user) return;

    // Paid events: apply wallet balance first, then charge the remainder.
    let paymentReference: string | null = null;
    const walletUsed =
      price > 0 && useWallet ? Math.min(walletBalance, price) : 0;
    const remainder = price - walletUsed;

    if (remainder > 0) {
      try {
        const result = await payWithPaystack({
          email: user.email ?? "",
          amountNaira: remainder,
          metadata: { purpose: "event_ticket", eventId, userId: user.id },
          // If the host has a payout subaccount, Paystack splits the charge
          // automatically: 90% to the host, 10% to LinkUpNaija.
          subaccount: hostSubaccount ?? undefined,
        });
        if (!result) {
          setLoading(false); // user closed the popup without paying
          return;
        }
        paymentReference = result.reference;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment failed.");
        setLoading(false);
        return;
      }
    }

    // Deduct the wallet portion server-side (balance-checked) only after any
    // Paystack charge succeeded.
    if (walletUsed > 0) {
      const { error: wErr } = await supabase.rpc("redeem_wallet", {
        p_amount: walletUsed,
        p_reason: `Ticket: ${eventTitle}`,
        p_event: eventId,
      });
      if (wErr) {
        setError(`Wallet payment failed: ${wErr.message}`);
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.from("rsvps").insert({
      event_id: eventId,
      user_id: user.id,
      status: "pending",
      paid: price > 0,
      payment_reference: paymentReference ?? (walletUsed > 0 ? "wallet" : null),
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Record the ticket sale (drives host payout) + notify.
    if (price > 0) {
      const { error: txErr } = await supabase.from("transactions").insert({
        event_id: eventId,
        user_id: user.id,
        amount: price,
        platform_fee: Math.round(price * 0.1),
        paystack_reference: paymentReference ?? "wallet",
      });
      if (txErr) console.error("Failed to record transaction:", txErr.message);

      await supabase.from("notifications").insert({
        user_id: user.id,
        event_id: eventId,
        message: `Payment confirmed ✅ You're going to ${eventTitle}!`,
      });
    }

    if (price > 0) confettiCoins();
    else confettiJoin();
    toast.success(
      price > 0
        ? "Payment confirmed ✅ Your request has been sent!"
        : "Request sent 🎉 The host will review it."
    );
    setStatus("pending");
    router.refresh();
    setLoading(false);
  }

  async function cancel() {
    setLoading(true);
    setError(null);
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase
      .from("rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id);
    if (error) setError(error.message);
    else {
      setStatus("none");
      router.refresh();
    }
    setLoading(false);
  }

  // Button label reflecting the wallet portion for paid events.
  const walletApplied =
    price > 0 && useWallet ? Math.min(walletBalance, price) : 0;
  const remainderDue = price - walletApplied;
  const remainderLabel =
    remainderDue === 0
      ? "Pay with wallet & request to join"
      : walletApplied > 0
        ? `Pay ${formatNaira(remainderDue)} & request to join`
        : `Pay ${formatNaira(price)} & request to join`;

  return (
    <div className="space-y-2">
      {status === "accepted" && (
        <>
          <div className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700">
            ✓ You&apos;re going! See you there 🎉
          </div>
          <button
            type="button"
            onClick={cancel}
            disabled={loading}
            className="btn-outline w-full"
          >
            {loading ? "…" : "Cancel my spot"}
          </button>
        </>
      )}

      {status === "pending" && (
        <>
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-700">
            ⏳ Request sent — waiting for the host to approve
          </div>
          <button
            type="button"
            onClick={cancel}
            disabled={loading}
            className="btn-outline w-full"
          >
            {loading ? "…" : "Cancel request"}
          </button>
        </>
      )}

      {status === "declined" && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
          Your request to join was declined.
        </div>
      )}

      {status === "none" &&
        (!isPro && requestsThisMonth >= FREE_REQUEST_LIMIT ? (
          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 px-4 py-4 text-center">
            <p className="text-sm font-semibold text-amber-800">
              You&apos;ve used all {FREE_REQUEST_LIMIT} free requests this month.
            </p>
            <Link href="/pro" className="btn-primary mt-3 w-full">
              ★ Upgrade to Pro to send more requests
            </Link>
          </div>
        ) : (
          <>
            {price > 0 && walletBalance > 0 && (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => setUseWallet(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand"
                />
                <span className="text-gray-700">
                  Use wallet balance{" "}
                  <span className="font-semibold text-brand">
                    ({formatNaira(walletBalance)} available)
                  </span>
                </span>
              </label>
            )}
            <button
              type="button"
              onClick={request}
              disabled={loading || isFull}
              className="btn-primary w-full"
            >
              {loading
                ? "Processing…"
                : isFull
                  ? "Event is full"
                  : price > 0
                    ? remainderLabel
                    : "Request to join"}
            </button>
          </>
        ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

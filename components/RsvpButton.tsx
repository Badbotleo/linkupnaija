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
}) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<JoinState>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // Paid events: collect payment before sending the request.
    let paymentReference: string | null = null;
    if (price > 0) {
      try {
        const result = await payWithPaystack({
          email: user.email ?? "",
          amountNaira: price,
          metadata: { purpose: "event_ticket", eventId, userId: user.id },
          // If the host has a payout subaccount, Paystack splits the ticket
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

    const { error } = await supabase.from("rsvps").insert({
      event_id: eventId,
      user_id: user.id,
      status: "pending",
      paid: price > 0,
      payment_reference: paymentReference,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Record the transaction + 10% platform fee for paid tickets.
    if (price > 0 && paymentReference) {
      const { error: txErr } = await supabase.from("transactions").insert({
        event_id: eventId,
        user_id: user.id,
        amount: price,
        platform_fee: Math.round(price * 0.1),
        paystack_reference: paymentReference,
      });
      if (txErr) console.error("Failed to record transaction:", txErr.message);

      // Payment-success notification.
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
                  ? `Pay ${formatNaira(price)} & request to join`
                  : "Request to join"}
          </button>
        ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { payWithPaystack, formatNaira } from "@/lib/paystack";
import { FREE_REQUEST_LIMIT } from "@/lib/pro";
import { confettiJoin, confettiCoins } from "@/lib/confetti";
import { toast } from "@/lib/toast";
import LineIcon from "./ui/LineIcon";
import { haptic } from "@/lib/haptics";
import type { RsvpStatus } from "@/lib/types";

type JoinState = "none" | RsvpStatus;

export default function RsvpButton({
  eventId,
  isLoggedIn,
  initialStatus,
  isHost,
  isFull,
  price,
  tiers = [],
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
  /** Ticket types on this event. Empty means the single price applies. */
  tiers?: {
    id: string;
    name: string;
    price: number;
    admits: number | null;
    description: string | null;
  }[];
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
  // Which package they're buying. Cheapest preselected so the common case is
  // one tap, but nothing is bought until they press the button either way.
  //
  // Declared with the other hooks, above the isLoggedIn and isHost early
  // returns — a hook after a conditional return doesn't run in the same order
  // every render, which is a real bug and not just a lint rule.
  const [tierId, setTierId] = useState<string | null>(
    tiers.length > 0 ? tiers[0].id : null
  );
  const chosen = tiers.find((x) => x.id === tierId) ?? null;
  // A tier's price replaces the event price. On a multi-tier event the event
  // price is a floor, not a thing anyone actually buys.
  const dueNow = chosen ? chosen.price : price;

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
      dueNow > 0 && useWallet ? Math.min(walletBalance, dueNow) : 0;
    const remainder = dueNow - walletUsed;

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

    // Upsert, not insert: cancelling deletes the row but a DECLINED request
    // leaves it behind, so asking again used to hit the (event_id, user_id)
    // unique constraint instead of re-opening the request.
    const { error } = await supabase.from("rsvps").upsert(
      {
        event_id: eventId,
        user_id: user.id,
        status: "pending",
        paid: dueNow > 0,
        tier_id: tierId,
        payment_reference: paymentReference ?? (walletUsed > 0 ? "wallet" : null),
      },
      { onConflict: "event_id,user_id" }
    );
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Record the ticket sale (drives host payout) + notify.
    if (dueNow > 0) {
      // This row IS the host's payout. If it doesn't land, the money was
      // taken and the host is never paid — and until now that failure was
      // written to console.error and the buyer was told "Payment confirmed".
      // Nobody would find out until a host asked where their money was.
      const txRow = {
        event_id: eventId,
        user_id: user.id,
        amount: dueNow,
        platform_fee: Math.round(dueNow * 0.1),
        paystack_reference: paymentReference ?? "wallet",
      };
      let { error: txErr } = await supabase.from("transactions").insert(txRow);
      if (txErr) {
        // One retry: the common cause is a transient network blip straight
        // after returning from the Paystack popup.
        ({ error: txErr } = await supabase.from("transactions").insert(txRow));
      }

      if (txErr) {
        console.error("Failed to record transaction:", txErr.message);
        // Never claim success here. They paid; we failed to record it. Give
        // them the reference so support can reconcile it against Paystack.
        haptic("error");
        setError(
          `Your payment went through, but we couldn't record it. Please send this reference to support@linkupnaija.com: ${
            paymentReference ?? "wallet"
          }`
        );
        setLoading(false);
        // The RSVP is already saved as paid, so they keep their spot.
        setStatus("pending");
        router.refresh();
        return;
      }

      await supabase.from("notifications").insert({
        user_id: user.id,
        event_id: eventId,
        message: `Payment confirmed ✅ You're going to ${eventTitle}!`,
      });
    }

    haptic("success");
    if (dueNow > 0) confettiCoins();
    else confettiJoin();
    toast.success(
      dueNow > 0
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
    dueNow > 0 && useWallet ? Math.min(walletBalance, dueNow) : 0;
  const remainderDue = dueNow - walletApplied;
  const remainderLabel =
    remainderDue === 0
      ? "Pay with wallet & request to join"
      : walletApplied > 0
        ? `Pay ${formatNaira(remainderDue)} & request to join`
        : `Pay ${formatNaira(dueNow)} & request to join`;

  return (
    <div className="space-y-2">
      {/* Pick a package before paying. Without this the host takes money and
          has no idea whether they owe a Combo Lite or a Gold Table. */}
      {tiers.length > 0 && status === "none" && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-black uppercase tracking-[0.12em] text-gray-500">
            Choose your ticket
          </legend>
          {tiers.map((x) => (
            <label
              key={x.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                tierId === x.id
                  ? "border-brand bg-brand-50/60"
                  : "border-gray-200 hover:border-brand/40"
              }`}
            >
              <input
                type="radio"
                name="tier"
                checked={tierId === x.id}
                onChange={() => setTierId(x.id)}
                className="mt-1 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    {x.name}
                    {!!x.admits && (
                      <span className="ml-1.5 font-medium text-gray-400">
                        · {x.admits} {x.admits === 1 ? "person" : "people"}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-gray-900">
                    {formatNaira(x.price)}
                  </span>
                </span>
                {x.description && (
                  <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                    {x.description}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {status === "accepted" && (
        <>
          <div className="rounded-xl bg-naija-50 px-4 py-3 text-center text-sm font-semibold text-naija-700">
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
            ⏳ Request sent. Waiting for the host to approve
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
            {/* The one decision this whole page exists for, so it stops
                looking like every other button on it.
                  · gradient in the brand, not a flat fill
                  · the price is the loud part, the verb is the quiet part —
                    people are deciding on the number
                  · lifts on press rather than just dimming, so a tap on a
                    slow connection feels like it did something
                  · sold out is grey and honest, not a disabled blue */}
            <button
              type="button"
              onClick={request}
              disabled={loading || isFull}
              className={`group relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition-all duration-200 ${
                isFull
                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                  : "bg-gradient-to-r from-brand-600 to-brand text-white shadow-lg shadow-brand/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/30 active:translate-y-0 active:shadow-md disabled:opacity-70"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  {isFull ? (
                    <span className="text-[15px] font-bold">
                      Sold out — nothing left
                    </span>
                  ) : loading ? (
                    <span className="text-[15px] font-bold">Processing…</span>
                  ) : dueNow > 0 ? (
                    <>
                      <span className="block text-[20px] font-extrabold leading-none tabular-nums">
                        {remainderDue === 0
                          ? "Paid with wallet"
                          : formatNaira(remainderDue)}
                      </span>
                      <span className="mt-1 block text-[12px] font-semibold text-white/75">
                        {chosen
                          ? `${chosen.name} · request to join`
                          : walletApplied > 0
                            ? `${formatNaira(walletApplied)} from wallet · request to join`
                            : "Request to join"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block text-[18px] font-extrabold leading-none">
                        Request to join
                      </span>
                      <span className="mt-1 block text-[12px] font-semibold text-white/75">
                        Free · the host approves you
                      </span>
                    </>
                  )}
                </span>
                {!isFull && !loading && (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 transition group-hover:translate-x-0.5">
                    <LineIcon name="chevronRight" size={17} />
                  </span>
                )}
              </span>
            </button>
          </>
        ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

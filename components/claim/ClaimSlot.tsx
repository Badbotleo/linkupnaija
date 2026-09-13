"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * The one button on a claim page.
 *
 * A claim is an ordinary join request carrying the giveaway tier, which is
 * what makes the rest of the system work without knowing this page exists: it
 * lands in the host's approvals list, and a claim that wins produces the same
 * scannable ticket a paid one does.
 *
 * NOTHING IS CAPPED HERE, and that is deliberate. A raffle tier runs with
 * quantity null so the stock trigger lets everybody in; draw_size decides how
 * many win, and draw_claim_winners() picks them. A cap would refuse the
 * eleventh claim, which in a draw is the one you most want.
 */
export default function ClaimSlot({
  eventId,
  tierId,
  isOpen,
  isLoggedIn,
  existingStatus,
  code,
}: {
  eventId: string;
  tierId: string;
  isOpen: boolean;
  isLoggedIn: boolean;
  existingStatus: string | null;
  code: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  if (existingStatus === "accepted") {
    return (
      <div className="rounded-2xl bg-green-50 p-4 text-center">
        <p className="text-[15px] font-bold text-green-900">You are in.</p>
        <Link
          href="/tickets"
          className="mt-2 inline-flex text-[14px] font-bold text-green-800 underline"
        >
          See your ticket
        </Link>
      </div>
    );
  }

  if (claimed || existingStatus === "pending") {
    return (
      <div className="rounded-2xl bg-brand-50 p-4 text-center">
        <p className="text-[15px] font-bold text-brand-700">
          You are in the draw.
        </p>
        <p className="mt-1 text-[13px] leading-snug text-brand-700/75">
          Fill in your profile while you wait. It decides your odds and it
          counts right up to the moment of the draw.
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(`/claim/${code}`)}`}
        className="btn-primary w-full"
      >
        Log in to claim
      </Link>
    );
  }

  if (!isOpen) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-center dark:border-white/20">
        <p className="text-[15px] font-bold text-gray-700 dark:text-white/80">
          Claiming has closed.
        </p>
        <Link
          href={`/events/${eventId}`}
          className="mt-1 inline-flex text-[14px] font-bold text-brand underline"
        >
          See the event anyway
        </Link>
      </div>
    );
  }

  async function claim() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Log in first.");
      setBusy(false);
      return;
    }

    const { error: err } = await supabase.from("rsvps").insert({
      event_id: eventId,
      user_id: user.id,
      tier_id: tierId,
      status: "pending",
      seats: 1,
    });
    setBusy(false);

    if (err) {
      // The database raises in plain English already, whether that is a
      // closed tier or a full one, so it is shown as written rather than
      // translated into something vaguer.
      setError(
        /duplicate|unique/i.test(err.message)
          ? "You have already claimed this one."
          : err.message
      );
      return;
    }
    setClaimed(true);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={claim}
        disabled={busy}
        className="btn-primary w-full disabled:opacity-50"
      >
        {busy ? "Claiming…" : "Enter the draw"}
      </button>
      {error && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

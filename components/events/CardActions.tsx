"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SITE_ORIGIN } from "@/lib/qr";
import { toast } from "@/lib/toast";

// The reaction row used to be three links straight into the event page. These
// act in place instead: Interested saves, Going sends the join request for
// free events, and Share opens the native sheet or copies the link.
const PATHS: Record<string, string> = {
  star: "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7L12 2z",
  check: "M20 6 9 17l-5-5",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
};

export default function CardActions({
  eventId,
  eventTitle,
  price,
}: {
  eventId: string;
  eventTitle: string;
  price: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [interested, setInterested] = useState(false);
  const [going, setGoing] = useState<"none" | "pending" | "accepted">("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!live || !user) return;
      setMe(user.id);

      const [{ data: int }, { data: rsvp }] = await Promise.all([
        supabase
          .from("event_interests")
          .select("event_id")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("rsvps")
          .select("status")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (!live) return;
      setInterested(!!int);
      if (rsvp?.status === "accepted") setGoing("accepted");
      else if (rsvp?.status === "pending") setGoing("pending");
    })();
    return () => {
      live = false;
    };
  }, [eventId, supabase]);

  function needsAuth() {
    if (me) return false;
    router.push(`/login?redirect=${encodeURIComponent(`/events/${eventId}`)}`);
    return true;
  }

  async function toggleInterest() {
    if (needsAuth() || busy) return;
    setBusy(true);
    const next = !interested;
    setInterested(next); // optimistic
    const { error } = next
      ? await supabase.from("event_interests").insert({ event_id: eventId, user_id: me })
      : await supabase
          .from("event_interests")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", me);
    if (error) {
      setInterested(!next);
      toast.error(error.message);
    } else if (next) {
      toast.success("Saved to your interested list");
    }
    setBusy(false);
  }

  async function join() {
    if (needsAuth() || busy) return;
    if (going !== "none") return;
    // Paid events need the wallet/Paystack flow, which lives on the event page.
    if (price > 0) {
      router.push(`/events/${eventId}`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("rsvps").upsert(
      { event_id: eventId, user_id: me, status: "pending", paid: false },
      { onConflict: "event_id,user_id" }
    );
    if (error) toast.error(error.message);
    else {
      setGoing("pending");
      toast.success("Request sent 🎉 The host will review it.");
    }
    setBusy(false);
  }

  async function share() {
    const url = `${SITE_ORIGIN}/events/${eventId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: eventTitle, text: `Pull up: ${eventTitle}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <div className="flex border-t border-gray-100">
      <Btn
        icon="star"
        label={interested ? "Interested" : "Interested"}
        active={interested}
        onClick={toggleInterest}
      />
      <Btn
        icon="check"
        label={going === "accepted" ? "Going" : going === "pending" ? "Requested" : "Going"}
        active={going !== "none"}
        onClick={join}
      />
      <Btn icon="share" label="Share" onClick={share} />
    </div>
  );
}

function Btn({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(e) => {
        // The whole card is a link — don't let the tap fall through to it.
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-brand-50 text-brand"
          : "text-gray-500 hover:bg-brand-50 hover:text-brand"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="17"
        height="17"
        fill={active && icon !== "share" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={PATHS[icon]} />
      </svg>
      {label}
    </button>
  );
}

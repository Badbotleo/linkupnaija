"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RsvpButton({
  eventId,
  isLoggedIn,
  initialJoined,
  isHost,
  isFull,
}: {
  eventId: string;
  isLoggedIn: boolean;
  initialJoined: boolean;
  isHost: boolean;
  isFull: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [joined, setJoined] = useState(initialJoined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?redirect=/events/${eventId}`}
        className="btn-primary w-full"
      >
        Log in to join
      </Link>
    );
  }

  if (isHost) {
    return (
      <div className="rounded-xl bg-brand-50 px-4 py-3 text-center text-sm font-semibold text-brand">
        🎤 You&apos;re hosting this event
      </div>
    );
  }

  async function toggle() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?redirect=/events/${eventId}`);
      return;
    }

    if (joined) {
      const { error } = await supabase
        .from("rsvps")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);
      if (error) {
        setError(error.message);
      } else {
        setJoined(false);
        router.refresh();
      }
    } else {
      const { error } = await supabase
        .from("rsvps")
        .insert({ event_id: eventId, user_id: user.id });
      if (error) {
        setError(error.message);
      } else {
        setJoined(true);
        router.refresh();
      }
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || (isFull && !joined)}
        className={joined ? "btn-outline w-full" : "btn-primary w-full"}
      >
        {loading
          ? "Saving…"
          : joined
            ? "✓ You're going — tap to cancel"
            : isFull
              ? "Event is full"
              : "Join this event"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

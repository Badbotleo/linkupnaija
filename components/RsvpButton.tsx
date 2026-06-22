"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { RsvpStatus } from "@/lib/types";

type JoinState = "none" | RsvpStatus;

export default function RsvpButton({
  eventId,
  isLoggedIn,
  initialStatus,
  isHost,
  isFull,
}: {
  eventId: string;
  isLoggedIn: boolean;
  initialStatus: JoinState;
  isHost: boolean;
  isFull: boolean;
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

  if (isHost) {
    return (
      <div className="rounded-xl bg-brand-50 px-4 py-3 text-center text-sm font-semibold text-brand">
        🎤 You&apos;re hosting this event
      </div>
    );
  }

  async function getUserId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=/events/${eventId}`);
      return null;
    }
    return user.id;
  }

  async function request() {
    setLoading(true);
    setError(null);
    const userId = await getUserId();
    if (!userId) return;
    const { error } = await supabase
      .from("rsvps")
      .insert({ event_id: eventId, user_id: userId, status: "pending" });
    if (error) setError(error.message);
    else {
      setStatus("pending");
      router.refresh();
    }
    setLoading(false);
  }

  async function cancel() {
    setLoading(true);
    setError(null);
    const userId = await getUserId();
    if (!userId) return;
    const { error } = await supabase
      .from("rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);
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

      {status === "none" && (
        <button
          type="button"
          onClick={request}
          disabled={loading || isFull}
          className="btn-primary w-full"
        >
          {loading
            ? "Sending…"
            : isFull
              ? "Event is full"
              : "Request to join"}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

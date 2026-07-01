"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export default function SeriesSubscribeButton({
  seriesId,
  isLoggedIn,
  initialSubscribed,
  initialCount,
}: {
  seriesId: string;
  isLoggedIn: boolean;
  initialSubscribed: boolean;
  initialCount: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  if (!isLoggedIn) {
    return (
      <Link href={`/login?redirect=/series/${seriesId}`} className="btn-primary w-full">
        Log in to subscribe
      </Link>
    );
  }

  async function toggle() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }

    if (subscribed) {
      const { error } = await supabase
        .from("series_subscriptions")
        .delete()
        .eq("series_id", seriesId)
        .eq("user_id", user.id);
      if (!error) {
        setSubscribed(false);
        setCount((c) => Math.max(0, c - 1));
      }
    } else {
      const { error } = await supabase
        .from("series_subscriptions")
        .insert({ series_id: seriesId, user_id: user.id });
      if (!error) {
        setSubscribed(true);
        setCount((c) => c + 1);
        toast.success("Subscribed 🔔 You'll be notified of new events.");
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={subscribed ? "btn-outline w-full" : "btn-primary w-full"}
      >
        {busy ? "…" : subscribed ? "✓ Subscribed" : "🔔 Subscribe to Series"}
      </button>
      <p className="mt-2 text-center text-sm text-gray-500">
        {count} {count === 1 ? "person follows" : "people follow"} this series
      </p>
    </div>
  );
}

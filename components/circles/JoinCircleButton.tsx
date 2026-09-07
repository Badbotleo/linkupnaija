"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LineIcon from "../ui/LineIcon";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export default function JoinCircleButton({
  circleId,
  isPrivate,
  isLoggedIn,
  isCreator,
  initialStatus,
}: {
  circleId: string;
  isPrivate: boolean;
  isLoggedIn: boolean;
  isCreator: boolean;
  initialStatus: "active" | "pending" | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  if (!isLoggedIn) {
    return (
      <Link href={`/login?redirect=/circles/${circleId}`} className="btn-primary w-full">
        Log in to join
      </Link>
    );
  }

  if (isCreator) {
    return (
      <span className="block rounded-xl bg-brand-50 px-4 py-2.5 text-center text-sm font-semibold text-brand">
        You&apos;re the admin
      </span>
    );
  }

  async function join() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const next = isPrivate ? "pending" : "active";
    const { error } = await supabase
      .from("circle_members")
      .insert({ circle_id: circleId, user_id: user.id, status: next });
    if (error) toast.error("Couldn't join. Try again.");
    else {
      setStatus(next);
      toast.success(isPrivate ? "Request sent" : "Joined");
      router.refresh();
    }
    setBusy(false);
  }

  async function leave() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", circleId)
      .eq("user_id", user.id);
    if (!error) {
      setStatus(null);
      router.refresh();
    }
    setBusy(false);
  }

  // A member does not need a button that says they are a member.
  //
  // This sat where X puts Follow, full width, and the only thing it did was
  // take you out of the circle you had just joined. The most prominent
  // control on the page was the exit. On Facebook and X, "Joined" collapses
  // into something quiet once you are in, and leaving is deliberate rather
  // than one mis-tap away.
  //
  // A details/summary so it needs no client state, and confirm() so a
  // fat-fingered tap does not silently remove somebody from a community.
  if (status === "active") {
    return (
      <details className="group relative">
        <summary
          className="flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-naija/10 px-3 py-2 text-sm font-bold text-naija-600 transition hover:bg-naija/15"
          aria-label="You are a member of this circle"
        >
          <LineIcon name="check" size={14} />
          Joined
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg dark:border-white/10 dark:bg-[#1a1a1a]">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm("Leave this circle? You can join again later.")) leave();
            }}
            className="w-full px-4 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            {busy ? "…" : "Leave circle"}
          </button>
        </div>
      </details>
    );
  }
  if (status === "pending") {
    return (
      <button
        type="button"
        onClick={leave}
        disabled={busy}
        className="rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 dark:bg-white/10 dark:text-white/70"
      >
        {busy ? "…" : "Requested · Cancel"}
      </button>
    );
  }
  return (
    <button type="button" onClick={join} disabled={busy} className="btn-primary w-full">
      {busy ? "…" : isPrivate ? "Request to join" : "Join"}
    </button>
  );
}

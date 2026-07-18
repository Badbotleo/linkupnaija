"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        👑 You&apos;re the admin
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
      toast.success(isPrivate ? "Request sent 🔔" : "Joined 🎉");
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

  if (status === "active") {
    return (
      <button type="button" onClick={leave} disabled={busy} className="btn-outline w-full">
        {busy ? "…" : "✓ Joined · Leave"}
      </button>
    );
  }
  if (status === "pending") {
    return (
      <button type="button" onClick={leave} disabled={busy} className="btn-outline w-full">
        {busy ? "…" : "Requested · Cancel"}
      </button>
    );
  }
  return (
    <button type="button" onClick={join} disabled={busy} className="btn-primary w-full">
      {busy ? "…" : isPrivate ? "🔒 Request to Join" : "Join Circle"}
    </button>
  );
}

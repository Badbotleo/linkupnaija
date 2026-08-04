"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Rel = "none" | "friends" | "outgoing" | "incoming" | "self";

export default function AddFriendButton({
  targetId,
  isLoggedIn,
}: {
  targetId: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rel, setRel] = useState<Rel>("none");
  const [connId, setConnId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      if (user.id === targetId) {
        setRel("self");
        return;
      }
      const { data } = await supabase
        .from("connections")
        .select("id, status, requester_id, receiver_id")
        .or(
          `and(requester_id.eq.${user.id},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${user.id})`
        )
        .maybeSingle();
      if (!data) return setRel("none");
      setConnId(data.id);
      if (data.status === "accepted") setRel("friends");
      else if (data.requester_id === user.id) setRel("outgoing");
      else setRel("incoming");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <Link href={`/login?redirect=/u/${targetId}`} className="btn-primary flex-1 rounded-full py-2 text-center">
        Add friend
      </Link>
    );
  }
  if (rel === "self") return null;

  async function add() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("connections")
      .insert({ requester_id: user.id, receiver_id: targetId, status: "pending" })
      .select("id")
      .single();
    setBusy(false);
    if (error) toast.error("Couldn't send request.");
    else {
      if (data?.id) setConnId(data.id);
      setRel("outgoing");
      toast.success("Friend request sent 👋");
    }
  }

  /** Take it back. A sent request used to be a dead end. */
  async function unsend() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    // Delete by id where we have one, otherwise by the pair — the id is
    // missing on a page load that found the request already sent.
    const q = supabase.from("connections").delete();
    const { error } = connId
      ? await q.eq("id", connId)
      : await q
          .eq("requester_id", user.id)
          .eq("receiver_id", targetId)
          .eq("status", "pending");
    setBusy(false);
    if (error) {
      toast.error("Couldn't cancel that request.");
      return;
    }
    setConnId(null);
    setRel("none");
    toast.success("Request cancelled");
    router.refresh();
  }

  async function accept() {
    if (!connId) return;
    setBusy(true);
    const { error } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .eq("id", connId);
    setBusy(false);
    if (!error) {
      setRel("friends");
      router.refresh();
    }
  }

  if (rel === "friends")
    return <span className="flex-1 rounded-full bg-naija-50 py-2 text-center text-sm font-semibold text-naija-600">✓ Friends</span>;
  if (rel === "outgoing")
    return (
      <button
        type="button"
        onClick={unsend}
        disabled={busy}
        aria-label="Cancel friend request"
        className="group flex-1 rounded-full bg-gray-100 py-2 text-center text-sm font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <span className="group-hover:hidden">Requested</span>
        <span className="hidden group-hover:inline">Cancel request</span>
      </button>
    );
  if (rel === "incoming")
    return (
      <button type="button" onClick={accept} disabled={busy} className="btn-primary flex-1 rounded-full py-2">
        Accept request
      </button>
    );
  return (
    <button type="button" onClick={add} disabled={busy} className="btn-primary flex-1 rounded-full py-2">
      {busy ? "…" : "Add friend"}
    </button>
  );
}

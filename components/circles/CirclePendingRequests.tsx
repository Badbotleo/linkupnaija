"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Avatar from "../Avatar";

interface Pending {
  id: string;
  user_id: string;
  users: { name: string | null; avatar_url: string | null } | null;
}

export default function CirclePendingRequests({ initial }: { initial: Pending[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function approve(id: string) {
    setBusy(id);
    const { error } = await supabase.from("circle_members").update({ status: "active" }).eq("id", id);
    if (!error) {
      setItems((p) => p.filter((i) => i.id !== id));
      router.refresh();
    }
    setBusy(null);
  }
  async function decline(id: string) {
    setBusy(id);
    const { error } = await supabase.from("circle_members").delete().eq("id", id);
    if (!error) setItems((p) => p.filter((i) => i.id !== id));
    setBusy(null);
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-bold text-amber-800">
        Join requests ({items.length})
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 rounded-xl bg-white p-2">
            {/* Approving a stranger into your circle without being able to
                look at them first is the decision this row exists for. */}
            <Link
              href={`/u/${i.user_id}`}
              className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
            >
              <Avatar name={i.users?.name ?? null} url={i.users?.avatar_url ?? null} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
                {i.users?.name ?? "Member"}
              </span>
            </Link>
            <button type="button" disabled={busy === i.id} onClick={() => approve(i.id)} className="btn-primary px-3 py-1 text-xs">
              Approve
            </button>
            <button type="button" disabled={busy === i.id} onClick={() => decline(i.id)} className="btn border border-red-200 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50">
              Decline
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

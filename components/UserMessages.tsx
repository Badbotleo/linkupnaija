"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MessageThread from "./MessageThread";
import type { Message } from "@/lib/types";

interface Conversation {
  otherId: string;
  otherName: string;
  last: string;
  unread: number;
}

export default function UserMessages({ meId }: { meId: string }) {
  const supabase = createClient();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Conversation | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
        .order("created_at", { ascending: false });
      const msgs = (data as Message[]) ?? [];

      const byOther = new Map<string, Conversation>();
      for (const m of msgs) {
        const otherId = m.sender_id === meId ? m.receiver_id : m.sender_id;
        if (!byOther.has(otherId)) {
          byOther.set(otherId, {
            otherId,
            otherName: "LinkUpNaija",
            last: m.message,
            unread: 0,
          });
        }
        if (m.receiver_id === meId && !m.read) {
          byOther.get(otherId)!.unread += 1;
        }
      }

      const ids = Array.from(byOther.keys());
      if (ids.length) {
        const { data: people } = await supabase
          .from("users")
          .select("id, name, is_admin")
          .in("id", ids);
        for (const p of (people as { id: string; name: string | null; is_admin: boolean }[]) ?? []) {
          const c = byOther.get(p.id);
          if (c) c.otherName = p.is_admin ? "LinkUpNaija Admin" : p.name ?? "Member";
        }
      }

      if (active) {
        setConvos(Array.from(byOther.values()));
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  if (open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="mb-3 text-sm font-medium text-gray-500 hover:text-brand"
        >
          ← Back to messages
        </button>
        <MessageThread
          meId={meId}
          otherId={open.otherId}
          otherName={open.otherName}
        />
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading messages…</p>;
  }

  if (convos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
        No messages yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      <ul className="divide-y divide-gray-50">
        {convos.map((c) => (
          <li key={c.otherId}>
            <button
              type="button"
              onClick={() => setOpen(c)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{c.otherName}</p>
                <p className="truncate text-sm text-gray-500">{c.last}</p>
              </div>
              {c.unread > 0 && (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {c.unread}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

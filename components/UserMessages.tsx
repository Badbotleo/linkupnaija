"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format";
import Avatar from "./Avatar";
import LineIcon from "./ui/LineIcon";
import MessageThread from "./MessageThread";
import type { Message } from "@/lib/types";

interface Conversation {
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  last: string;
  lastAt: string;
  lastFromMe: boolean;
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
            otherAvatar: null,
            last: m.message,
            lastAt: m.created_at,
            lastFromMe: m.sender_id === meId,
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
          .select("id, name, is_admin, avatar_url")
          .in("id", ids);
        for (const p of (people as {
          id: string;
          name: string | null;
          is_admin: boolean;
          avatar_url: string | null;
        }[]) ?? []) {
          const c = byOther.get(p.id);
          if (c) {
            c.otherName = p.is_admin ? "LinkUpNaija Admin" : p.name ?? "Member";
            c.otherAvatar = p.avatar_url;
          }
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
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition hover:text-brand"
        >
          <span aria-hidden>←</span> All messages
        </button>
        <MessageThread
          meId={meId}
          otherId={open.otherId}
          otherName={open.otherName}
          otherAvatar={open.otherAvatar}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0">
            <div className="h-11 w-11 shrink-0 rounded-full bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-gray-100" />
              <div className="h-3 w-44 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (convos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-brand shadow-sm">
          <LineIcon name="chat" size={22} />
        </span>
        <p className="mt-3 font-bold text-gray-900">No messages yet</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
          Message a host from any event page, or start a chat from a friend&apos;s profile.
        </p>
        <Link href="/events" className="btn-primary mt-4">
          Explore events
        </Link>
      </div>
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
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
            >
              <div className="relative shrink-0">
                <Avatar name={c.otherName} url={c.otherAvatar} size="md" />
                {c.unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white ring-2 ring-white">
                    {c.unread > 9 ? "9+" : c.unread}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className={`truncate ${c.unread > 0 ? "font-extrabold text-gray-900" : "font-semibold text-gray-900"}`}>
                    {c.otherName}
                  </p>
                  <span className="ml-auto shrink-0 text-xs text-gray-400">
                    {timeAgo(c.lastAt)}
                  </span>
                </div>
                <p className={`truncate text-sm ${c.unread > 0 ? "font-medium text-gray-800" : "text-gray-500"}`}>
                  {c.lastFromMe && <span className="text-gray-400">You: </span>}
                  {c.last}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

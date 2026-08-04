"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
import LineIcon from "./ui/LineIcon";
import type { Message } from "@/lib/types";

export default function MessageThread({
  meId,
  otherId,
  otherName,
  otherAvatar,
}: {
  meId: string;
  otherId: string;
  otherName: string;
  otherAvatar?: string | null;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    let active = true;

    async function markRead() {
      await supabase
        .from("messages")
        .update({ read: true })
        .eq("receiver_id", meId)
        .eq("sender_id", otherId)
        .eq("read", false);
    }

    supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${meId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${meId})`
      )
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setMessages((data as Message[]) ?? []);
        setLoading(false);
        markRead();
      });

    const channel = supabase
      .channel(`dm-${meId}-${otherId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${meId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id !== otherId) return;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
          markRead();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, otherId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const { data } = await supabase
      .from("messages")
      .insert({ sender_id: meId, receiver_id: otherId, message: text })
      .select("*")
      .single();
    if (data) setMessages((prev) => [...prev, data as Message]);
  }

  return (
    <div className="flex h-[30rem] flex-col overflow-hidden surface">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <Avatar name={otherName} url={otherAvatar ?? null} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-bold leading-tight text-gray-900">{otherName}</p>
          <p className="text-xs text-gray-400">
            {messages.length > 0
              ? `${messages.length} message${messages.length === 1 ? "" : "s"}`
              : "New conversation"}
          </p>
        </div>
      </div>

      {/* Transcript — chat wallpaper keeps bubbles from floating on flat white */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{
          backgroundImage:
            "radial-gradient(rgba(83,74,183,0.055) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        {loading ? (
          <p className="text-center text-sm text-gray-400">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand">
              <LineIcon name="chat" size={22} />
            </span>
            <p className="mt-3 text-sm font-semibold text-gray-700">
              No messages yet
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Say hello to {otherName.split(" ")[0]}.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === meId;
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            // Group runs from the same sender: only the last bubble gets a tail.
            const lastOfRun = !next || next.sender_id !== m.sender_id
              || dayKey(next.created_at) !== dayKey(m.created_at);
            const firstOfRun = !prev || prev.sender_id !== m.sender_id || newDay;

            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-3 flex items-center gap-3">
                    <span className="h-px flex-1 bg-gray-200" />
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-gray-500 shadow-sm">
                      {dayLabel(m.created_at)}
                    </span>
                    <span className="h-px flex-1 bg-gray-200" />
                  </div>
                )}

                <div
                  className={`flex ${mine ? "justify-end" : "justify-start"} ${
                    firstOfRun ? "mt-2" : "mt-0.5"
                  }`}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={`px-3.5 py-2 text-sm shadow-sm ${
                        mine
                          ? `bg-brand text-white ${lastOfRun ? "rounded-2xl rounded-br-md" : "rounded-2xl"}`
                          : `bg-white text-gray-900 ring-1 ring-gray-100 ${lastOfRun ? "rounded-2xl rounded-bl-md" : "rounded-2xl"}`
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.message}</p>
                    </div>
                    {lastOfRun && (
                      <p
                        className={`mt-1 flex items-center gap-1 px-1 text-[11px] text-gray-400 ${
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        {clockTime(m.created_at)}
                        {mine && (
                          <span
                            title={m.read ? "Read" : "Sent"}
                            className={m.read ? "text-brand" : "text-gray-300"}
                          >
                            ✓✓
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-gray-100 bg-white p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${otherName.split(" ")[0]}…`}
          className="input flex-1 rounded-full"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send message"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:bg-brand-600 disabled:opacity-40"
        >
          <LineIcon name="send" size={18} />
        </button>
      </form>
    </div>
  );
}

const dayKey = (iso: string) => iso.slice(0, 10);

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dayKey(iso) === today.toISOString().slice(0, 10)) return "Today";
  if (dayKey(iso) === yest.toISOString().slice(0, 10)) return "Yesterday";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

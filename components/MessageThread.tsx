"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

export default function MessageThread({
  meId,
  otherId,
  otherName,
}: {
  meId: string;
  otherId: string;
  otherName: string;
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
    <div className="flex h-[28rem] flex-col rounded-2xl border border-gray-100 bg-white shadow-card">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="font-bold text-gray-900">{otherName}</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-sm text-gray-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="m-auto text-center text-sm text-gray-400">
            No messages yet. Say hello 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm bg-brand text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-gray-100 p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="btn-primary px-4"
        >
          Send
        </button>
      </form>
    </div>
  );
}

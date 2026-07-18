"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessageUI } from "@/lib/types";

export default function ChatPanel({
  eventId,
  currentUserId,
  currentUserName,
  initialMessages,
}: {
  eventId: string;
  currentUserId: string;
  currentUserName: string;
  initialMessages: ChatMessageUI[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessageUI[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Cache of user_id -> display name so realtime inserts can show a name.
  const nameCache = useRef<Record<string, string>>(
    Object.fromEntries(
      initialMessages.map((m) => [m.user_id, m.senderName])
    )
  );
  nameCache.current[currentUserId] = currentUserName;

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const channel = supabase
      .channel(`event-chat-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            message: string;
            created_at: string;
          };

          // Resolve the sender's name (look it up once, then cache it).
          let senderName = nameCache.current[row.user_id];
          if (!senderName) {
            const { data } = await supabase
              .from("users")
              .select("name")
              .eq("id", row.user_id)
              .single();
            senderName = data?.name ?? "Member";
            nameCache.current[row.user_id] = senderName;
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev; // dedupe
            return [
              ...prev,
              {
                id: row.id,
                user_id: row.user_id,
                message: row.message,
                created_at: row.created_at,
                senderName,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    const { error } = await supabase
      .from("chat_messages")
      .insert({ event_id: eventId, user_id: currentUserId, message: text });

    if (error) {
      setError(error.message);
    } else {
      setDraft(""); // realtime will append the message
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-card">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="font-bold text-gray-900">💬 Group chat</h2>
        <p className="text-xs text-gray-500">
          Private to everyone going to this event.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex max-h-[28rem] min-h-[16rem] flex-col gap-3 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-center text-sm text-gray-400">
            No messages yet. Say hi to your fellow attendees! 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm bg-brand text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-900"
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 text-xs font-bold text-brand">
                      {m.senderName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                </div>
                <span className="mt-1 px-1 text-[11px] text-gray-400">
                  {mine ? "You" : m.senderName} ·{" "}
                  {new Date(m.created_at).toLocaleString("en-NG", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
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
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          maxLength={2000}
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="btn-primary px-4"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
      {error && (
        <p className="px-4 pb-3 text-sm text-red-600">Could not send: {error}</p>
      )}
    </div>
  );
}

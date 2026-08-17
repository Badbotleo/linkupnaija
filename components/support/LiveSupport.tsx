"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import LineIcon from "../ui/LineIcon";

/**
 * The human half of the chat: hand off from Paddy to a person.
 *
 * Answered from /admin/support. Requires an account — RLS scopes a thread to
 * auth.uid(), and there is deliberately no anonymous read path, so a logged-out
 * visitor is asked to sign in rather than shown a chat that silently fails.
 *
 * Realtime, so a reply lands without a refresh.
 */

interface Message {
  id: string;
  sender: "user" | "admin";
  body: string;
  created_at: string;
}

/**
 * Nigerian working hours, roughly. A "live" badge that lies is worse than no
 * badge — outside these, the widget still takes the message but says plainly
 * that the reply comes later.
 */
function withinSupportHours(d = new Date()) {
  // WAT is UTC+1 year-round; no DST to get wrong.
  const wat = new Date(d.getTime() + 60 * 60 * 1000);
  const day = wat.getUTCDay(); // 0 Sun
  const hour = wat.getUTCHours();
  if (day === 0) return false;
  return hour >= 9 && hour < 21;
}

export default function LiveSupport({ onBack }: { onBack?: () => void }) {
  const supabase = createClient();
  const [me, setMe] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const foot = useRef<HTMLDivElement>(null);

  const live = withinSupportHours();

  // Find this person's thread, or hold off creating one until they actually
  // write — an empty thread in the inbox is noise.
  const boot = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMe(user?.id ?? null);
    if (!user) {
      setReady(true);
      return;
    }
    const { data: t } = await supabase
      .from("support_threads")
      .select("id")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (t?.id) {
      setThreadId(t.id);
      const { data: msgs } = await supabase
        .from("support_messages")
        .select("id, sender, body, created_at")
        .eq("thread_id", t.id)
        .order("created_at", { ascending: true });
      setMessages((msgs ?? []) as Message[]);
    }
    setReady(true);
  }, [supabase]);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (!threadId) return;
    const ch = supabase
      .channel(`support-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((list) =>
            list.some((x) => x.id === m.id) ? list : [...list, m]
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, threadId]);

  useEffect(() => {
    foot.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || !me || sending) return;
    setSending(true);

    let id = threadId;
    if (!id) {
      // First message creates the thread. .select() because an INSERT that RLS
      // filters out returns no error and no rows.
      const { data, error } = await supabase
        .from("support_threads")
        .insert({ user_id: me, subject: body.slice(0, 60) })
        .select("id");
      if (error || !data || data.length === 0) {
        setSending(false);
        // Say what actually went wrong. "Try again" is useless advice when the
        // table doesn't exist yet, and it cost a round trip to find that out.
        toast.error(
          error?.code === "PGRST205"
            ? "Support isn't set up yet — the database migration hasn't been run."
            : error?.message ?? "Couldn't start the chat."
        );
        return;
      }
      id = data[0].id as string;
      setThreadId(id);
    }

    const { data, error } = await supabase
      .from("support_messages")
      .insert({ thread_id: id, sender: "user", author_id: me, body })
      .select("id, sender, body, created_at");
    setSending(false);

    if (error || !data || data.length === 0) {
      toast.error(error?.message ?? "That didn't send. Try again.");
      return;
    }
    setMessages((list) => [...list, data[0] as Message]);
    setDraft("");
  }

  if (!ready) {
    return <p className="p-4 text-sm text-gray-400">Connecting…</p>;
  }

  if (!me) {
    return (
      <div className="p-5 text-center">
        <p className="text-sm font-bold text-gray-900">Log in to reach us</p>
        <p className="mt-1 text-xs text-gray-500">
          So we can reply to you, and you can find the conversation again.
        </p>
        <Link
          href="/login?redirect=/"
          className="btn-primary mt-3 inline-flex py-1.5 text-sm"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Paddy"
            className="rounded-full p-1 text-gray-400 hover:text-gray-700"
          >
            <LineIcon name="chevronLeft" size={15} />
          </button>
        )}
        <span
          className={`h-2 w-2 rounded-full ${
            live ? "bg-naija" : "bg-gray-300"
          }`}
          aria-hidden
        />
        <p className="text-sm font-bold text-gray-900">
          {live ? "Live support" : "Leave a message"}
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-gray-500">
            {live
              ? "Ask away — someone's here."
              : "We're offline right now. Leave your message and we'll reply when we're back."}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                m.sender === "user"
                  ? "ml-auto bg-brand text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.body}
            </div>
          ))
        )}
        <div ref={foot} />
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          maxLength={4000}
          placeholder="Type your message…"
          className="input min-w-0 flex-1 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-40"
        >
          <LineIcon name="send" size={14} />
        </button>
      </div>
    </div>
  );
}

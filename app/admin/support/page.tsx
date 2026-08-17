"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";
import Avatar from "@/components/Avatar";

/**
 * The support inbox — where you answer.
 *
 * Threads on the left, conversation on the right, sorted so the ones waiting
 * on you float to the top. Realtime on both, so a message that arrives while
 * you're reading another thread bumps its row without a refresh.
 */

interface Thread {
  id: string;
  user_id: string | null;
  subject: string | null;
  status: "open" | "closed";
  last_message_at: string;
  last_sender: "user" | "admin";
  users: { name: string | null; avatar_url: string | null } | null;
}

interface Message {
  id: string;
  thread_id: string;
  sender: "user" | "admin";
  body: string;
  created_at: string;
}

const THREAD_COLS =
  "id, user_id, subject, status, last_message_at, last_sender, users(name, avatar_url)";

export default function AdminSupportPage() {
  const supabase = createClient();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [active, setActive] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [denied, setDenied] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const foot = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const q = supabase
      .from("support_threads")
      .select(THREAD_COLS)
      .order("last_message_at", { ascending: false })
      .limit(100);
    const { data, error } = showClosed ? await q : await q.eq("status", "open");

    if (error) {
      // RLS hides everything from a non-admin, which reads as an empty inbox.
      // Say which it is rather than showing "no conversations" to someone who
      // simply isn't allowed to look.
      setDenied(true);
      setThreads([]);
      return;
    }
    setThreads((data ?? []) as unknown as Thread[]);
  }, [supabase, showClosed]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // A new message anywhere reorders the list; one arriving in the thread
  // you're reading also appends to it.
  useEffect(() => {
    const ch = supabase
      .channel("admin-support")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const m = payload.new as Message;
          loadThreads();
          if (m.thread_id === active?.id) {
            setMessages((list) =>
              list && list.some((x) => x.id === m.id) ? list : [...(list ?? []), m]
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, active?.id, loadThreads]);

  async function open(t: Thread) {
    setActive(t);
    setMessages(null);
    const { data, error } = await supabase
      .from("support_messages")
      .select("id, thread_id, sender, body, created_at")
      .eq("thread_id", t.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Couldn't load that conversation.");
      setMessages([]);
      return;
    }
    setMessages((data ?? []) as Message[]);

    // Mark their messages read. Fire-and-forget: a failure here costs a badge,
    // not a message.
    await supabase
      .from("support_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", t.id)
      .eq("sender", "user")
      .is("read_at", null);
  }

  useEffect(() => {
    foot.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || !active || sending) return;
    setSending(true);
    // .select() is not decoration. An INSERT that RLS filters out returns no
    // error and zero rows, and this app has shipped that bug four times.
    const { data, error } = await supabase
      .from("support_messages")
      .insert({ thread_id: active.id, sender: "admin", body })
      .select("id, thread_id, sender, body, created_at");
    setSending(false);

    if (error) return toast.error(error.message);
    if (!data || data.length === 0) {
      toast.error("That didn't save — you may not have admin rights.");
      return;
    }
    setMessages((list) => [...(list ?? []), data[0] as Message]);
    setDraft("");
    loadThreads();
  }

  async function setStatus(status: "open" | "closed") {
    if (!active) return;
    const { data, error } = await supabase
      .from("support_threads")
      .update({ status })
      .eq("id", active.id)
      .select("id");
    if (error) return toast.error(error.message);
    if (!data || data.length === 0)
      return toast.error("Couldn't change that — check your admin rights.");
    setActive({ ...active, status });
    loadThreads();
  }

  if (denied) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-lg font-bold text-gray-900">Admins only</p>
        <p className="mt-1 text-sm text-gray-500">
          This inbox is only visible to admin accounts.
        </p>
        <Link href="/admin" className="btn-outline mt-4 inline-flex">
          Back to admin
        </Link>
      </div>
    );
  }

  const waiting = (threads ?? []).filter((t) => t.last_sender === "user").length;

  return (
    <div className="container-page py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Support</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {waiting > 0
              ? `${waiting} waiting on a reply`
              : "Nothing waiting on you"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowClosed((s) => !s)}
          className="btn-outline py-1.5 text-sm"
        >
          {showClosed ? "Open only" : "Show closed"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Threads */}
        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-100 bg-white">
          {threads === null ? (
            <p className="p-4 text-sm text-gray-400">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              No conversations yet. They&apos;ll appear here the moment someone
              asks for a human.
            </p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => open(t)}
                className={`flex w-full items-start gap-2.5 border-b border-gray-100 p-3 text-left transition ${
                  active?.id === t.id ? "bg-brand/5" : "hover:bg-gray-50"
                }`}
              >
                <Avatar
                  name={t.users?.name ?? null}
                  url={t.users?.avatar_url ?? null}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">
                    {t.users?.name ?? "Someone"}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {t.subject ?? "Support"}
                  </p>
                </div>
                {/* The only status worth a dot: they spoke last. */}
                {t.last_sender === "user" && (
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand"
                    aria-label="Waiting on a reply"
                  />
                )}
              </button>
            ))
          )}
        </div>

        {/* Conversation */}
        <div className="flex max-h-[70vh] flex-col rounded-2xl border border-gray-100 bg-white">
          {!active ? (
            <p className="p-6 text-sm text-gray-400">
              Pick a conversation to read it.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-3">
                <p className="truncate font-bold text-gray-900">
                  {active.users?.name ?? "Someone"}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setStatus(active.status === "open" ? "closed" : "open")
                  }
                  className="btn-outline py-1 text-xs"
                >
                  {active.status === "open" ? "Close" : "Reopen"}
                </button>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                {messages === null ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                        m.sender === "admin"
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

              <div className="flex items-center gap-2 border-t border-gray-100 p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                  maxLength={4000}
                  placeholder="Write a reply…"
                  className="input min-w-0 flex-1 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  aria-label="Send reply"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-40"
                >
                  <LineIcon name="send" size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

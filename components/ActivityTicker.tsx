"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const KEY = "activity_ticker_dismissed";

interface RsvpRow {
  users: { name: string | null } | null;
  events: { id: string; title: string | null; state: string | null } | null;
}
interface EventRow {
  id: string;
  title: string | null;
  state: string | null;
  max_attendees: number | null;
  host: { name: string | null } | null;
  rsvps: { status: string }[];
}

// Each message remembers which event it came from so we can drop it live
// when an admin deletes that event.
interface TickerMessage {
  eventId: string | null;
  text: string;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function ActivityTicker() {
  const supabase = createClient();
  const [messages, setMessages] = useState<TickerMessage[]>([]);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
    } catch {
      // ignore
    }

    let active = true;
    (async () => {
      const [{ data: rsvps }, { data: events }] = await Promise.all([
        supabase
          .from("rsvps")
          .select("users(name), events(id, title, state)")
          .eq("status", "accepted")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("events")
          .select(
            "id, title, state, max_attendees, host:users!events_host_id_fkey(name), rsvps(status)"
          )
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      if (!active) return;

      const msgs: TickerMessage[] = [];

      for (const r of (rsvps ?? []) as unknown as RsvpRow[]) {
        if (r.users?.name && r.events?.title) {
          msgs.push({
            eventId: r.events.id,
            text: `${r.users.name} just joined ${r.events.title}${
              r.events.state ? ` in ${r.events.state}` : ""
            } 🎉`,
          });
        }
      }
      for (const e of (events ?? []) as unknown as EventRow[]) {
        if (e.host?.name && e.title) {
          msgs.push({
            eventId: e.id,
            text: `${e.host.name} just hosted ${e.title}${
              e.state ? ` in ${e.state}` : ""
            } 📚`,
          });
        }
        const accepted = (e.rsvps ?? []).filter(
          (x) => x.status === "accepted"
        ).length;
        if (e.title && accepted < 10) {
          const left = e.max_attendees
            ? e.max_attendees - accepted
            : 10 - accepted;
          if (left > 0)
            msgs.push({ eventId: e.id, text: `⚡ ${left} spots left for ${e.title}` });
        }
      }
      msgs.push({
        eventId: null,
        text: `🔥 ${rand(8, 47)} people viewed the FC26 Tournament in the last hour`,
      });

      // shuffle for variety
      for (let i = msgs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [msgs[i], msgs[j]] = [msgs[j], msgs[i]];
      }

      setMessages(msgs);
      setTimeout(() => active && setShow(true), 3000); // slide in after 3s
    })();

    // Live prune: when an event is deleted (e.g. by an admin removing spam),
    // drop its ticker messages immediately instead of waiting for a reload.
    const channel = supabase
      .channel(`ticker-event-deletes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "events" },
        (payload) => {
          const deletedId = (payload.old as { id?: string }).id;
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.eventId !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!show || messages.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      4000
    );
    return () => clearInterval(id);
  }, [show, messages.length]);

  function dismiss() {
    setShow(false);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
  }

  if (!show || messages.length === 0) return null;

  // Clamp: the list can shrink under us when events are deleted live.
  const current = messages[index % messages.length];

  return (
    <div
      className="fixed bottom-36 left-4 right-4 z-40 sm:left-auto sm:right-5 sm:w-[22rem] lg:bottom-24"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-2 rounded-full border border-brand/30 px-4 py-2.5 text-sm text-white shadow-lg"
        style={{ backgroundColor: "#1A1040" }}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span
          key={index}
          className="animate-fade-in-up flex-1 truncate text-[#DAD8F0]"
        >
          {current.text}
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss activity feed"
          className="shrink-0 text-white/50 transition hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

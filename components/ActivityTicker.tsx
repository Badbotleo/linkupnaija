"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@/lib/supabase/client";

const KEY = "activity_ticker_dismissed";

/**
 * Event titles run long ("EMGC Study in Malaysia Expo with IDP Nigeria"), and
 * at this card's width a full one overruns two lines and gets sliced mid-word
 * by the clamp. Cutting it here puts the break under our control and keeps the
 * part that carries the meaning: the name, and enough title to recognise it.
 */
function short(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "\u2026";
}

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
  /** The person or number the line is about, set in bold. */
  who: string;
  /** The rest of the sentence. */
  rest: string;
}

export default function ActivityTicker() {
  const supabase = createClient();
  const [messages, setMessages] = useState<TickerMessage[]>([]);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const [paused, setPaused] = useState(false);

  // NOT ON AN EVENT PAGE.
  //
  // Everywhere else this floats over browsing, which is cheap. An event page
  // is the one screen with a decision and a price on it, and the card lands
  // bottom-right directly over the ticket row — so the thing it covers is
  // exactly the thing somebody came to read. Proof that other people are
  // around is worth least on the page where you are already looking at one
  // specific night.
  const pathname = usePathname();
  const onEventPage = (pathname ?? "").startsWith("/events/");

  useEffect(() => {
    if (onEventPage) return;
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
          .select("users!rsvps_user_id_fkey(name), events(id, title, state)")
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
            who: short(r.users.name, 22),
            rest: `joined ${short(r.events.title, 40)}`,
          });
        }
      }
      for (const e of (events ?? []) as unknown as EventRow[]) {
        if (e.host?.name && e.title) {
          msgs.push({
            eventId: e.id,
            who: short(e.host.name, 22),
            rest: `is hosting ${short(e.title, 38)}`,
          });
        }
        const accepted = (e.rsvps ?? []).filter(
          (x) => x.status === "accepted"
        ).length;
        // Only once somebody has actually joined. An empty event announcing
        // "10 spots left" is scarcity we invented, and it reads as empty.
        if (e.title && accepted >= 1 && accepted < 10) {
          const left = e.max_attendees
            ? e.max_attendees - accepted
            : 10 - accepted;
          if (left > 0)
            msgs.push({
              eventId: e.id,
              who: `${left} ${left === 1 ? "spot" : "spots"} left`,
              rest: `for ${short(e.title, 42)}`,
            });
        }
      }
      // shuffle for variety
      for (let i = msgs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [msgs[i], msgs[j]] = [msgs[j], msgs[i]];
      }

      // AT MOST TWO MESSAGES.
      //
      // The claim this makes is "other people are here", and it is either
      // believed on the first card or it is not. Cycling five of them does
      // not make it five times truer; it just moves in the corner of
      // somebody's eye for five times as long.
      setMessages(msgs.slice(0, 2));

      // In after 3s, gone by 11. It used to sit for 24 seconds, which on a
      // first visit is most of the time anyone spends deciding what this
      // place is — a long while to have something animating over the page.
      // Social proof that never leaves is just furniture in front of the
      // content.
      setTimeout(() => active && setShow(true), 3000);
      setTimeout(() => active && setShow(false), 3000 + 8_000);
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
  }, [onEventPage]);

  // Hold while someone is reading or reaching for it. A card that changes
  // under the thumb is a card nobody can tap.
  useEffect(() => {
    if (!show || paused || messages.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      5200
    );
    return () => clearInterval(id);
  }, [show, paused, messages.length]);

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

  const body = (
    <>
      <span className="relative mt-[3px] flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-naija-400 opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-naija" />
      </span>
      <span
        key={index}
        className="animate-fade-in-up line-clamp-2 flex-1 text-[#DAD8F0] motion-reduce:animate-none"
      >
        <span className="font-bold text-white">{current.who}</span>{" "}
        {current.rest}
      </span>
    </>
  );

  return (
    <div
      className="pointer-events-none fixed bottom-[8.5rem] right-3 z-30 w-[min(17rem,calc(100vw-1.5rem))] sm:right-5 sm:w-[20rem] lg:bottom-24"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className="pointer-events-auto relative overflow-hidden rounded-2xl border border-brand/30 text-xs shadow-lg"
        style={{ backgroundColor: "#121212" }}
      >
        {/* The whole card is the target. Social proof that cannot be acted on
            is decoration: this one goes to the thing it is boasting about. */}
        {current.eventId ? (
          <Link
            href={`/events/${current.eventId}`}
            onClick={dismiss}
            className="flex items-start gap-2 py-2 pl-3 pr-9 transition hover:bg-white/5"
          >
            {body}
          </Link>
        ) : (
          <div className="flex items-start gap-2 py-2 pl-3 pr-9">{body}</div>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss activity feed"
          className="absolute right-0 top-0 grid h-9 w-9 place-items-center text-white/45 transition hover:text-white"
        >
          <LineIcon name="x" size={14} />
        </button>

        {/* How long until it changes, so it does not feel arbitrary. */}
        {messages.length > 1 && (
          <span
            key={`bar-${index}-${paused}`}
            aria-hidden
            className={`absolute bottom-0 left-0 h-[2px] bg-brand/60 motion-reduce:animate-none motion-reduce:w-0 ${
              paused ? "" : "ticker-progress"
            }`}
          />
        )}
      </div>

      <style jsx global>{`
        .ticker-progress {
          animation: ticker-progress 5.2s linear forwards;
        }
        @keyframes ticker-progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

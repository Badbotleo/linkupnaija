"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import EventCard from "./EventCard";
import type { EventRow } from "@/lib/types";

type FeedEvent = EventRow & {
  attendeeCount: number;
  hostRating: { avg: number; count: number } | null;
};

export default function EventsList({
  events,
  stateFilter,
}: {
  events: FeedEvent[];
  stateFilter?: string;
}) {
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return events;
    return events.filter((e) =>
      [e.title, e.description, e.location, e.category]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term))
    );
  }, [events, term]);

  return (
    <div>
      {/* Search bar */}
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          aria-hidden
        >
          <SearchIcon />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events by title, vibe, or location…"
          aria-label="Search events"
          className="input pl-10 pr-10"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Results */}
      {events.length === 0 ? (
        <EmptyState
          title={
            stateFilter
              ? `No events here yet — be the first to host one in ${stateFilter}!`
              : "No events here yet — be the first to host one!"
          }
          subtitle="Got a vibe in mind? Set it up in a couple of minutes and gather your people."
          cta
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={`No events found for “${query.trim()}”`}
          subtitle="Try another search term, or clear the search to see everything."
          action={
            <button
              type="button"
              onClick={() => setQuery("")}
              className="btn-outline mt-6"
            >
              Clear search
            </button>
          }
        />
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event, i) => (
            <div
              key={event.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 11) * 80}ms` }}
            >
              <EventCard
                event={event}
                attendeeCount={event.attendeeCount}
                hostRating={event.hostRating}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  cta = false,
  action,
}: {
  title: string;
  subtitle: string;
  cta?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
      <p className="text-4xl">🗓️</p>
      <h2 className="mt-3 text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-gray-500">{subtitle}</p>
      {cta && (
        <Link href="/host" className="btn-primary mt-6">
          Host an event
        </Link>
      )}
      {action}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

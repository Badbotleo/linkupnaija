"use client";

import Link from "next/link";
import EventCard from "./EventCard";
import type { EventRow } from "@/lib/types";

type FeedEvent = EventRow & {
  attendeeCount: number;
  hostRating: { avg: number; count: number } | null;
};

export interface FriendsGoing {
  count: number;
  names: string[];
  avatars: (string | null)[];
}

export default function EventsList({
  events,
  stateFilter,
  trendingIds = [],
  recommendedAll = false,
  hostBadgesByHost = {},
  friendsGoing = {},
}: {
  events: FeedEvent[];
  stateFilter?: string;
  trendingIds?: string[];
  recommendedAll?: boolean;
  hostBadgesByHost?: Record<string, import("@/lib/hostBadges").Badge[]>;
  friendsGoing?: Record<string, FriendsGoing>;
}) {
  const trendingSet = new Set(trendingIds);

  return (
    <div>

      {/* Results */}
      {events.length === 0 ? (
        <EmptyState
          title={
            stateFilter
              ? `No events here yet. Be the first to host one in ${stateFilter}!`
              : "No events here yet. Be the first to host one!"
          }
          subtitle="Got a vibe in mind? Set it up in a couple of minutes and gather your people."
          cta
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => (
            <div
              key={event.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 11) * 80}ms` }}
            >
              <EventCard
                event={event}
                attendeeCount={event.attendeeCount}
                hostRating={event.hostRating}
                hostBadges={hostBadgesByHost[event.host_id]}
                trending={trendingSet.has(event.id)}
                recommended={recommendedAll}
                friendsGoing={friendsGoing[event.id]}
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



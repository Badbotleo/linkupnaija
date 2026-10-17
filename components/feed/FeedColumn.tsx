import Link from "next/link";
import LineIcon from "@/components/ui/LineIcon";
import RecapReel from "@/components/home/RecapReel";
import RateVenuePrompt from "@/components/venues/RateVenuePrompt";
import ThingsToDo from "@/components/home/ThingsToDo";
import FeedCard from "./FeedCard";
import SignupUnit from "./SignupUnit";
import PeopleYouMet from "./PeopleYouMet";
import { categoryPhoto } from "@/lib/category-photos";
import type { FeedUnit } from "@/lib/feed";

/**
 * Renders a column of feed units. Shared by the signed-in feed and the
 * logged-out one, which is the point: a visitor and a member should be
 * reading the same product, and the only differences should be the ones
 * that have a reason (no friend row for someone with no friends yet, no
 * rate-a-venue chore for someone who has never booked).
 */
export default function FeedColumn({
  units,
  state,
  userId,
}: {
  units: FeedUnit[];
  state: string | null;
  /** Null for a logged-out visitor. */
  userId: string | null;
}) {
  return (
    <>
      {units.map((unit, i) => {
        switch (unit.kind) {
          case "stories":
            return (
              <section
                key="stories"
                className="overflow-hidden rounded-2xl bg-white py-3 shadow-[var(--e1)] dark:bg-white/[0.04]"
              >
                <h2 className="px-4 text-[13px] font-bold uppercase tracking-[0.12em] text-gray-400">
                  This actually happened
                </h2>
                {/* RecapReel expects a horizontal scroller as its parent. */}
                <div className="no-scrollbar mt-2.5 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                  <RecapReel recaps={unit.recaps} />
                </div>
              </section>
            );

          case "event":
            return (
              <FeedCard
                key={`${unit.event.id}-${i}`}
                event={unit.event}
                friends={unit.friends}
                reason={unit.reason}
                mine={unit.mine}
              />
            );

          case "signup":
            return (
              <SignupUnit
                key={`signup-${unit.variant}`}
                variant={unit.variant}
                state={state}
              />
            );

          case "people":
            // Needs a signed-in viewer to insert a connection as. The unit is
            // only ever built for one, but the column is shared with the
            // logged-out feed, so this stays honest about it.
            return userId ? (
              <PeopleYouMet
                key="people"
                people={unit.people}
                meId={userId}
              />
            ) : null;

          case "rate":
            return userId ? (
              <RateVenuePrompt key="rate" userId={userId} />
            ) : null;

          case "circle":
            return (
              <Link
                key={`circle-${unit.circle.id}`}
                href={`/circles/${unit.circle.id}`}
                className="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[var(--e1)] dark:bg-white/[0.04]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    unit.circle.cover_image_url ??
                    categoryPhoto(unit.circle.category ?? "Party")
                  }
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-gray-400">
                    A circle you&apos;re not in
                  </p>
                  <p className="mt-0.5 truncate font-bold text-gray-900 group-hover:text-brand">
                    {unit.circle.name}
                  </p>
                  <p className="truncate text-[13px] text-gray-500">
                    {[unit.circle.category, unit.circle.state]
                      .filter(Boolean)
                      .join(" · ") || "New circle"}
                  </p>
                </div>
                <LineIcon
                  name="chevronRight"
                  size={16}
                  className="shrink-0 text-gray-400"
                />
              </Link>
            );

          case "venue":
            return (
              <Link
                key={`venue-${unit.venue.id}`}
                href="/venues"
                className="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[var(--e1)] dark:bg-white/[0.04]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={unit.venue.image_url ?? "/venues/restaurants.jpg"}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#A07A2C]">
                    Reserve through us
                  </p>
                  <p className="mt-0.5 truncate font-bold text-gray-900 group-hover:text-brand">
                    {unit.venue.name}
                  </p>
                  <p className="truncate text-[13px] text-gray-500">
                    {[unit.venue.category, unit.venue.state]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <LineIcon
                  name="chevronRight"
                  size={16}
                  className="shrink-0 text-gray-400"
                />
              </Link>
            );

          case "ideas":
            // The ideas shelf is the one thing here that stays a shelf: it is
            // eight interchangeable prompts, and a column of eight full-width
            // "host it yourself" cards would be a lecture.
            return (
              <div key="ideas" className="-mx-4 sm:-mx-6 lg:-mx-8">
                <ThingsToDo state={state} />
              </div>
            );
        }
      })}
    </>
  );
}

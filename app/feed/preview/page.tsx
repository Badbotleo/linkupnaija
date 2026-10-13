import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Composer from "@/components/feed/Composer";
import FeedCard from "@/components/feed/FeedCard";
import type { FeedEvent } from "@/lib/feed";
import type { FriendUser } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * A LOOK AT THE FEED, NOTHING MORE.
 *
 * /feed needs a session, and signing in as the owner is not something this
 * side of the keyboard does. So this renders the same components against
 * real public events with a stand-in viewer, purely so the layout can be
 * seen and argued about before anyone commits to it.
 *
 * Dev only, 404 in production, and safe to delete the moment the real page
 * has been looked at while signed in. The "friends" below are invented
 * placeholders: no real member is shown as going anywhere.
 */

const STAND_IN: FriendUser[] = [
  { id: "preview-1", name: "Tobi A", avatar_url: null, state: "Lagos" },
  { id: "preview-2", name: "Ada N", avatar_url: null, state: "Lagos" },
  { id: "preview-3", name: "Chidi O", avatar_url: null, state: "Lagos" },
  { id: "preview-4", name: "Zainab M", avatar_url: null, state: "Abuja" },
];

export default async function FeedPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("events")
    .select(
      "id, title, category, date, time, location, state, price, cover_image_url, is_listing, organiser_name"
    )
    .eq("event_type", "general")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(6);

  const events = (data ?? []) as FeedEvent[];

  // Each card shows a different state of the unit, so one screenshot answers
  // what the layout does in every case it has.
  const cases: {
    friends: FriendUser[];
    reason: string;
    mine: "going" | "hosting" | null;
  }[] = [
    { friends: [], reason: "You're hosting this", mine: "hosting" },
    {
      friends: STAND_IN.slice(0, 3),
      reason: "Tobi and 2 others are going",
      mine: null,
    },
    { friends: STAND_IN.slice(0, 1), reason: "Ada is going", mine: null },
    { friends: [], reason: "In Lagos, 3 days away", mine: null },
    { friends: [], reason: "Featured this week", mine: null },
    { friends: [], reason: "Coming up on LinkUpNaija", mine: null },
  ];

  return (
    <div className="container-page max-w-[600px] space-y-3 py-5">
      <div className="rounded-2xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <p className="font-black uppercase tracking-[0.12em]">Preview only</p>
        <p className="mt-1">
          Real events, invented attendees. The live page at /feed ranks these
          against your own connections and interests. Dev only, 404 in
          production.
        </p>
      </div>

      <Composer userId="preview" avatarUrl={null} firstName="Leonard" />

      {events.map((e, i) => (
        <FeedCard
          key={e.id}
          event={e}
          friends={cases[i]?.friends ?? []}
          reason={cases[i]?.reason ?? "Coming up on LinkUpNaija"}
          mine={cases[i]?.mine ?? null}
        />
      ))}
    </div>
  );
}

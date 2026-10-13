import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import Composer from "@/components/feed/Composer";
import FeedColumn from "@/components/feed/FeedColumn";
import { buildFeed, buildVisitorFeed } from "@/lib/feed";
import { getVisitorState } from "@/lib/visitor-geo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Feed",
  description: "One column instead of twelve shelves.",
  robots: { index: false, follow: false },
};

/**
 * Both home pages, one route, so they can be compared against / in either
 * state without signing in and out of two URLs.
 *
 * Signed in: a column ranked per member, with the friend signal.
 * Signed out: a count, a place picker and the real list, with the account
 * asked for twice on the way down rather than once on arrival.
 *
 * Deliberately reversible. Nothing shared is mutated, nothing is removed
 * from /, and the route is noindex because it is an experiment, not a page.
 */
export default async function FeedPage({
  searchParams,
}: {
  searchParams: { state?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const feed = await buildVisitorFeed(
      supabase,
      getVisitorState(),
      searchParams.state ?? null
    );
    const shown = feed.state
      ? (feed.places.find((p) => p.state === feed.state)?.n ?? 0)
      : feed.total;

    return (
      <div className="container-page max-w-[600px] space-y-3 pb-28 pt-5 lg:pb-14">
        {/* No slogan. The only headline a stranger needs is the one that
            proves something is on near them, and it is a fact rather than a
            claim, so it can be checked by scrolling. */}
        <header>
          <h1 className="text-[27px] font-extrabold leading-[1.1] tracking-[-0.03em] text-gray-900 sm:text-[32px]">
            <span className="text-brand">{shown}</span> link-up
            {shown === 1 ? "" : "s"} coming up
            {feed.state ? ` in ${feed.state}` : " in Nigeria"}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-gray-500">
            Open to look. An account is for joining.
          </p>
        </header>

        {/* The place picker, built from events that exist. A state with
            nothing on is not offered, because offering it is a promise we
            then break one tap later. */}
        {feed.places.length > 1 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0">
            <PlaceChip label="Everywhere" href="/feed" on={!feed.state} />
            {feed.places.slice(0, 8).map((p) => (
              <PlaceChip
                key={p.state}
                label={`${p.state} (${p.n})`}
                href={`/feed?state=${encodeURIComponent(p.state)}`}
                on={feed.state === p.state}
              />
            ))}
          </div>
        )}

        <FeedColumn units={feed.units} state={feed.state} userId={null} />

        {feed.shown < shown && (
          <Link
            href={
              feed.state
                ? `/events?state=${encodeURIComponent(feed.state)}`
                : "/events"
            }
            className="block rounded-2xl bg-white px-4 py-4 text-center text-[14.5px] font-bold text-brand shadow-[var(--e1)] transition hover:bg-gray-50 dark:bg-white/[0.04]"
          >
            See all {shown} link-ups
            {feed.state ? ` in ${feed.state}` : ""}
          </Link>
        )}
      </div>
    );
  }

  const { data: me } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", user.id)
    .single<{ avatar_url: string | null }>();

  const feed = await buildFeed(supabase, user.id);

  return (
    <div>
      <AppHeader title="Feed" subtitle={<>One column, ranked for you</>} back />

      <div className="container-page max-w-[600px] space-y-3 pb-28 pt-4 lg:pb-14">
        <Composer
          userId={user.id}
          avatarUrl={me?.avatar_url ?? null}
          firstName={feed.firstName}
        />

        {/* The experiment's own scoreboard. Here because the whole question
            is whether the friend signal has anything to work with: if
            "friends going" is 0 on every card, this layout is the shelved
            one with extra steps, and that is worth seeing on the page rather
            than arguing about. Comes out if this ever ships for real. */}
        <div className="rounded-2xl border border-dashed border-brand/30 bg-brand-50/60 px-4 py-3 text-[12.5px] leading-relaxed text-gray-600 dark:bg-brand/10 dark:text-white/70">
          <p className="font-bold uppercase tracking-[0.12em] text-brand">
            Experiment
          </p>
          <p className="mt-1">
            {feed.debug.candidates} upcoming events ranked, {feed.debug.inState}{" "}
            in {feed.state ?? "your state"}.{" "}
            {feed.debug.friendCount === 0
              ? "You have no connections yet, so no card can show who else is going."
              : `${feed.debug.friendCount} connection${
                  feed.debug.friendCount === 1 ? "" : "s"
                }, showing on ${feed.debug.withFriends} card${
                  feed.debug.withFriends === 1 ? "" : "s"
                }.`}{" "}
            <Link href="/" className="font-bold text-brand hover:underline">
              Compare with the shelves
            </Link>
          </p>
        </div>

        <FeedColumn units={feed.units} state={feed.state} userId={user.id} />
      </div>
    </div>
  );
}

function PlaceChip({
  label,
  href,
  on,
}: {
  label: string;
  href: string;
  on: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-bold transition ${
        on
          ? "bg-brand text-white"
          : "bg-white text-gray-700 shadow-[var(--e1)] hover:bg-gray-50 dark:bg-white/[0.06] dark:text-white/80"
      }`}
    >
      {label}
    </Link>
  );
}

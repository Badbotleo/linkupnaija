import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Composer from "@/components/feed/Composer";
import FeedColumn from "@/components/feed/FeedColumn";
import { buildFeed, buildVisitorFeed } from "@/lib/feed";
import { getVisitorState } from "@/lib/visitor-geo";

export const dynamic = "force-dynamic";

/**
 * Home, for everybody.
 *
 * Signed in: one column, ranked for the member, with who else is going on
 * every card that has an answer.
 * Signed out: a count, a place picker and the real list, with the account
 * asked for twice on the way down rather than once on arrival.
 *
 * WHAT THIS REPLACED, AND WHY. The old page is parked whole at /classic. For
 * members it was twelve shelves in a fixed order, which is one editorial
 * decision made once for every member on the platform; the order was a guess
 * and it was the same guess for everybody. For visitors it was a landing
 * page: a hero, a tour, promises, testimonials, and the events some way down.
 *
 * Both are now the same column, because a visitor and a member should be
 * reading the same product. The only differences left are ones with a
 * reason: no friend row for somebody who has no friends here yet, no
 * composer for somebody with no account to host from, and the account asked
 * for where it would buy something specific.
 *
 * NO SLOGAN. The only headline a stranger needs is the one proving something
 * is on near them, and it is a fact they can check by scrolling rather than a
 * claim they have to take on trust.
 */
export default async function HomePage({
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
      getVisitorState(),
      searchParams.state ?? null
    );
    const total = feed.state
      ? (feed.places.find((p) => p.state === feed.state)?.n ?? 0)
      : feed.total;

    return (
      <div className="container-page max-w-[600px] space-y-3 pb-10 pt-5 lg:pb-6">
        <header>
          <h1 className="text-[27px] font-extrabold leading-[1.1] tracking-[-0.03em] text-gray-900 sm:text-[32px]">
            <span className="text-brand">{total}</span> link-up
            {total === 1 ? "" : "s"} coming up
            {feed.state ? ` in ${feed.state}` : " in Nigeria"}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-gray-500">
            Open to look. An account is for joining.
          </p>
        </header>

        {/* The place picker, built from events that exist. A state with
            nothing on is never offered, because offering it is a promise we
            break one tap later. */}
        {feed.places.length > 1 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0">
            <PlaceChip label="Everywhere" href="/" on={!feed.state} />
            {feed.places.slice(0, 8).map((p) => (
              <PlaceChip
                key={p.state}
                label={`${p.state} (${p.n})`}
                href={`/?state=${encodeURIComponent(p.state)}`}
                on={feed.state === p.state}
              />
            ))}
          </div>
        )}

        <FeedColumn units={feed.units} state={feed.state} userId={null} />

        {feed.shown < total && (
          <Link
            href={
              feed.state
                ? `/events?state=${encodeURIComponent(feed.state)}`
                : "/events"
            }
            className="block rounded-2xl bg-white px-4 py-4 text-center text-[14.5px] font-bold text-brand shadow-[var(--e1)] transition hover:bg-gray-50 dark:bg-white/[0.04]"
          >
            See all {total} link-ups
            {feed.state ? ` in ${feed.state}` : ""}
          </Link>
        )}
      </div>
    );
  }

  const [{ data: me }, feed] = await Promise.all([
    supabase
      .from("users")
      .select("avatar_url")
      .eq("id", user.id)
      .single<{ avatar_url: string | null }>(),
    buildFeed(supabase, user.id),
  ]);

  return (
    <div className="container-page max-w-[600px] space-y-3 pb-10 pt-4 lg:pb-6">
      <Composer
        userId={user.id}
        avatarUrl={me?.avatar_url ?? null}
        firstName={feed.firstName}
      />
      <FeedColumn units={feed.units} state={feed.state} userId={user.id} />
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

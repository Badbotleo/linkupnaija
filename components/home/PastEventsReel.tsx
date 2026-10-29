import Rail from "./Rail";
import RecapReel from "./RecapReel";
import { getRecapsFor } from "@/lib/recaps";

/**
 * "This actually happened" — recap footage from past events.
 *
 * Everything else on the home page is a promise about the future: upcoming
 * listings, ideas to host, attendee counts that are mostly zero. This is the
 * one shelf that shows a night that already went ahead, with a crowd in it.
 *
 * Fetches here on the server; RecapReel does the playing, because sound and
 * the full-screen player need client state.
 */
export default async function PastEventsReel({
  state,
}: {
  state?: string | null;
}) {
  // 40, matching the query's own ceiling in lib/recaps.ts, so nothing that
  // was fetched is silently thrown away before it reaches the shelf.
  //
  // This was 12, which throttled the shelf for a cost that no longer exists.
  // RecapReel mounts only the first three cards with a source and uses an
  // IntersectionObserver to fetch the rest just before they scroll into view,
  // so a longer shelf downloads no more than a short one until somebody
  // actually swipes. The old number predated that and was never revisited.
  const recaps = await getRecapsFor(state, 40);
  // No recaps yet → render nothing. An empty "this actually happened" shelf
  // would say the opposite of what it exists to say.
  if (recaps.length === 0) return null;

  return (
    <Rail
      title="This actually happened"
      subtitle="Tap to watch recent link-ups, as they went down"
      href="/events?tab=past"
      seeAll="See past events"
    >
      <RecapReel recaps={recaps} />
    </Rail>
  );
}

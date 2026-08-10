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
  const recaps = await getRecapsFor(state, 12);
  // No recaps yet → render nothing. An empty "this actually happened" shelf
  // would say the opposite of what it exists to say.
  if (recaps.length === 0) return null;

  return (
    <Rail
      title="This actually happened"
      subtitle="Tap to watch — recent link-ups, as they went down"
      href="/events?tab=past"
      seeAll="See past events"
    >
      <RecapReel recaps={recaps} />
    </Rail>
  );
}

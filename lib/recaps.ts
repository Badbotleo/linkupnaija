import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { isRealText } from "./content-guards";
import { byProximity } from "./state-proximity";

/**
 * Recaps of events that already happened — the public proof this place is alive.
 *
 * A visitor arriving on a young platform has no way to tell whether anything
 * ever actually occurs here. Every other signal we could show them is a
 * promise about the future: upcoming listings, ideas, empty attendee counts.
 * Footage from a night that already happened is the only one that isn't.
 *
 * Public by design. The event gallery is images-only and RLS-gated to the host
 * and accepted attendees, which makes it useless for convincing someone who
 * hasn't signed up — exactly the person we need to convince.
 */

export interface Recap {
  id: string;
  /** Blank when the clip has its own burned-in text. */
  title: string | null;
  mediaUrl: string;
  mediaType: "video" | "image";
  state: string | null;
  credit: string | null;
  /** Set when the recap is still linked to a live event page. */
  event: { id: string; title: string; date: string } | null;
}

interface Row {
  id: string;
  title: string | null;
  media_url: string | null;
  media_type: string | null;
  state: string | null;
  credit: string | null;
  event: { id: string; title: string; date: string } | null;
}

const getRecaps = unstable_cache(
  async (): Promise<Recap[]> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
      .from("event_recaps")
      .select(
        "id, title, media_url, media_type, state, credit, event:events(id, title, date)"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(40);

    // Thrown, not swallowed: unstable_cache caches returned values, so a
    // single failed request would otherwise pin an empty reel in place for
    // the whole revalidate window. Thrown errors are not cached.
    if (error) throw new Error(`event_recaps: ${error.message}`);

    return ((data ?? []) as unknown as Row[])
      // A recap with no media is nothing at all.
      .filter((r) => isRealText(r.media_url, 8))
      .map((r) => ({
        id: r.id,
        title: isRealText(r.title) ? r.title : null,
        mediaUrl: r.media_url!,
        mediaType: r.media_type === "image" ? "image" : "video",
        state: r.state,
        credit: isRealText(r.credit) ? r.credit : null,
        event: r.event ?? null,
      }));
  },
  ["event-recaps"],
  { revalidate: 300 }
);

/**
 * Recaps for a viewer, nearest first.
 *
 * Same rule as the ideas shelf: sorted, never filtered. Someone in Kano
 * should see Abuja footage rather than an empty shelf — it is still proof
 * that events happen, just not proof they happen next door.
 *
 * Never throws. This is a supporting shelf on the home page; if it can't
 * load, the page should render without it rather than fail.
 */
export async function getRecapsFor(
  state?: string | null,
  limit = 12
): Promise<Recap[]> {
  const all = await getRecaps().catch(() => [] as Recap[]);
  return byProximity(all, state, (r) => r.state).slice(0, limit);
}

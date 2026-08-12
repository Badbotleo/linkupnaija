import { createClient } from "@/lib/supabase/server";

/**
 * Featured events — the ones that appear everywhere, not just in the feed.
 *
 * `featured` + `featured_until` already existed but only changed a card's
 * badge and its position in /events. "Featured" that you have to open the
 * events tab to notice isn't featured, so this is the shared query that puts
 * them on the home pages too.
 *
 * Time-boxed by design: featured_until means a placement expires on its own.
 * A boost with no end date is a boost somebody has to remember to switch off,
 * and nobody ever does.
 */

export interface FeaturedEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  state: string | null;
  price: number;
  cover_image_url: string | null;
  partner: { slug: string; name: string } | null;
}

export async function getFeaturedEvents(limit = 6): Promise<FeaturedEvent[]> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, category, date, time, location, state, price, cover_image_url, partner:partners(slug, name)"
    )
    .eq("event_type", "general")
    .eq("featured", true)
    .gt("featured_until", now)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(limit);

  // Never throw: this is a supporting shelf. A failure means no shelf, not a
  // broken home page. The partners embed is the likely failure, and it takes
  // the whole query with it — which is why nothing here is load-bearing.
  if (error) return [];
  return (data ?? []) as unknown as FeaturedEvent[];
}

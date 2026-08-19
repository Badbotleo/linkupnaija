import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_ORIGIN } from "@/lib/qr";

/**
 * The sitemap, built from the database rather than maintained by hand.
 *
 * Without one, Google had to find every event page by crawling its way there
 * from the feed — which for a listing that scrolls and paginates means the
 * newest events, the ones with a date attached and a reason to hurry, are the
 * least likely to be discovered in time to matter.
 *
 * Regenerated hourly. Events are time-sensitive enough that a daily sitemap
 * would miss same-week listings entirely.
 */
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

const STATIC: { path: string; priority: number; freq: Entry["changeFrequency"] }[] =
  [
    { path: "", priority: 1, freq: "daily" },
    { path: "/events", priority: 0.9, freq: "daily" },
    { path: "/venues", priority: 0.8, freq: "weekly" },
    { path: "/things-to-do", priority: 0.8, freq: "weekly" },
    { path: "/circles", priority: 0.6, freq: "weekly" },
    { path: "/host", priority: 0.6, freq: "monthly" },
    { path: "/rides", priority: 0.5, freq: "monthly" },
    { path: "/defcon", priority: 0.5, freq: "monthly" },
  ];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = STATIC.map((s) => ({
    url: `${SITE_ORIGIN}${s.path}`,
    lastModified: new Date(),
    changeFrequency: s.freq,
    priority: s.priority,
  }));

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Past events keep their page and can still rank — an old listing is how
    // people find out this is a real platform with a history — but they get
    // the lowest priority and no crawl urgency.
    const today = new Date().toISOString().slice(0, 10);
    const { data: events } = await supabase
      .from("events")
      .select("id, date, created_at")
      .eq("event_type", "general")
      .order("date", { ascending: false })
      .limit(2000);

    for (const e of events ?? []) {
      const upcoming = (e.date as string) >= today;
      base.push({
        url: `${SITE_ORIGIN}/events/${e.id}`,
        lastModified: new Date((e.created_at as string) ?? Date.now()),
        changeFrequency: upcoming ? "daily" : "yearly",
        priority: upcoming ? 0.9 : 0.3,
      });
    }

    const { data: venues } = await supabase
      .from("venues")
      .select("id")
      .eq("is_active", true)
      .limit(500);

    for (const v of venues ?? []) {
      base.push({
        url: `${SITE_ORIGIN}/venues/${v.id}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch {
    // A sitemap that 500s is worse than a short one: Google drops the whole
    // file rather than reading the static half. Fall back to the pages we
    // know exist without asking the database.
  }

  return base;
}

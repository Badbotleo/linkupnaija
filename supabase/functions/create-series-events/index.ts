// LinkUpNaija — auto-create the next event for each recurring series.
//
// Runs daily. For every series that no longer has an upcoming event, it creates
// the next one (dated forward from the last event by the series frequency). The
// events-insert trigger then notifies subscribers and files their auto-RSVPs.
//
// Deploy: supabase functions deploy create-series-events
// Schedule daily via pg_cron (see other migrations for the pattern).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function advance(dateStr: string, frequency: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "biweekly") d.setUTCDate(d.getUTCDate() + 14);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date().toISOString().slice(0, 10);

  const { data: series } = await supabase
    .from("event_series")
    .select(
      "id, host_id, title, description, category, state, location, frequency, cover_image_url"
    );

  let created = 0;

  for (const s of series ?? []) {
    // Skip series that still have an upcoming event.
    const { count: upcoming } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("series_id", s.id)
      .gte("date", today);
    if ((upcoming ?? 0) > 0) continue;

    // Base the next date/time on the most recent event.
    const { data: last } = await supabase
      .from("events")
      .select("date, time")
      .eq("series_id", s.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) continue;

    let next = advance(last.date as string, s.frequency);
    while (next < today) next = advance(next, s.frequency);

    const { error } = await supabase.from("events").insert({
      series_id: s.id,
      host_id: s.host_id,
      title: s.title,
      description: s.description ?? "",
      category: s.category ?? "Networking",
      state: s.state ?? "",
      location: s.location ?? "",
      date: next,
      time: (last.time as string) ?? "18:00:00",
      event_type: "general",
      cover_image_url: s.cover_image_url,
    });
    if (!error) created++;
  }

  return new Response(JSON.stringify({ seriesChecked: series?.length ?? 0, created }), {
    headers: { "Content-Type": "application/json" },
  });
});

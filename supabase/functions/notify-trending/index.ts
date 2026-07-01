// LinkUpNaija — trending-events notifier (run daily via pg_cron).
//
// Finds events with 5+ RSVPs in the last 24h and notifies users in the same
// state — max once per user per day (deduped via notification_flags).
//
// Deploy: supabase functions deploy notify-trending

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  // Count recent RSVPs per event.
  const { data: recent } = await supabase
    .from("rsvps")
    .select("event_id")
    .gte("created_at", since);
  const counts = new Map<string, number>();
  for (const r of (recent ?? []) as { event_id: string }[]) {
    counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
  }
  const trendingIds = Array.from(counts.entries())
    .filter(([, n]) => n >= 5)
    .map(([id]) => id);
  if (trendingIds.length === 0) return json({ trending: 0, notified: 0 });

  const { data: events } = await supabase
    .from("events")
    .select("id, title, state, date")
    .in("id", trendingIds)
    .gte("date", today);

  let notified = 0;
  for (const ev of (events ?? []) as { id: string; title: string; state: string }[]) {
    if (!ev.state) continue;
    const joinedToday = counts.get(ev.id) ?? 0;

    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("state", ev.state)
      .limit(2000);

    for (const u of (users ?? []) as { id: string }[]) {
      // Max 1 trending notification per user per day.
      const { error: flagErr } = await supabase
        .from("notification_flags")
        .insert({ user_id: u.id, key: `trending:${today}` });
      if (flagErr) continue; // already notified today (unique violation)

      await supabase.from("notifications").insert({
        user_id: u.id,
        event_id: ev.id,
        message: `🔥 "${ev.title}" is trending in ${ev.state} — ${joinedToday} people joined today`,
      });
      notified++;
    }
  }

  return json({ trending: trendingIds.length, notified });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

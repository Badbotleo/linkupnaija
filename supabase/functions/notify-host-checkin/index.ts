// LinkUpNaija — post-event host check-in reminder (run daily via pg_cron).
//
// The day after an event ends, remind the host to mark who actually showed up
// (that powers their attendance rate on the host scorecard). Sent once per
// event, deduped via notification_flags.
//
// Deploy: supabase functions deploy notify-host-checkin
// Schedule daily, e.g.:
//   select cron.schedule('host-checkin-daily','0 9 * * *',
//     $$ select public._invoke_fn('notify-host-checkin'); $$);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date().toISOString().slice(0, 10);
  const windowStart = new Date(Date.now() - 3 * 86400000)
    .toISOString()
    .slice(0, 10);

  // Recently-ended events (last 3 days), so we don't spam old ones.
  const { data: events } = await supabase
    .from("events")
    .select("id, title, host_id")
    .lt("date", today)
    .gte("date", windowStart);

  let notified = 0;

  for (const ev of (events ?? []) as {
    id: string;
    title: string;
    host_id: string;
  }[]) {
    // Only worth prompting if there were accepted attendees to grade.
    const { count } = await supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .eq("status", "accepted");
    if (!count) continue;

    // Dedup: one reminder per event (unique on user_id + key).
    const { error: flagErr } = await supabase
      .from("notification_flags")
      .insert({ user_id: ev.host_id, key: `host_checkin:${ev.id}` });
    if (flagErr) continue; // already reminded

    await supabase.from("notifications").insert({
      user_id: ev.host_id,
      event_id: ev.id,
      message: `"${ev.title}" has ended — mark who showed up to update your host scorecard ✅`,
    });
    notified++;
  }

  return new Response(JSON.stringify({ events: events?.length ?? 0, notified }), {
    headers: { "Content-Type": "application/json" },
  });
});

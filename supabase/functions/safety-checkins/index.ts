// LinkUpNaija — safety check-in prompts (run every ~15-30 min via pg_cron).
//
// For attendees who shared their plans:
//  • ~1h after the event start → "Are you safe? Tap to check in ✅"
//  • ~30 min later, if still not checked in → a follow-up nudge.
// (Trusted-contact SMS alerts require a Twilio integration — not wired here.)
//
// Deploy: supabase functions deploy safety-checkins

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = Date.now();

  // Pending check-ins (plans shared, not yet checked in), with event timing.
  const { data: rows } = await supabase
    .from("safety_checkins")
    .select("id, user_id, event_id, prompted_at, checked_in_at, events(title, date, time)")
    .not("shared_at", "is", null)
    .is("checked_in_at", null)
    .limit(500);

  let prompted = 0;
  let followedUp = 0;

  for (const r of (rows ?? []) as unknown as {
    id: string;
    user_id: string;
    event_id: string;
    prompted_at: string | null;
    events: { title: string; date: string; time: string } | null;
  }[]) {
    if (!r.events) continue;
    const start = new Date(`${r.events.date}T${r.events.time}`).getTime();
    const hoursSinceStart = (now - start) / 3600000;

    if (!r.prompted_at && hoursSinceStart >= 1) {
      await supabase.from("notifications").insert({
        user_id: r.user_id,
        event_id: r.event_id,
        message: `Are you safe after "${r.events.title}"? Tap to check in ✅`,
      });
      await supabase
        .from("safety_checkins")
        .update({ prompted_at: new Date().toISOString() })
        .eq("id", r.id);
      prompted++;
    } else if (r.prompted_at) {
      const minsSincePrompt = (now - new Date(r.prompted_at).getTime()) / 60000;
      // Follow up once, ~30 min after the first prompt (before 65 min elapse).
      if (minsSincePrompt >= 30 && minsSincePrompt < 65) {
        await supabase.from("notifications").insert({
          user_id: r.user_id,
          event_id: r.event_id,
          message: `Still there? Please check in to let us know you're safe ✅`,
        });
        followedUp++;
      }
    }
  }

  return json({ prompted, followedUp });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

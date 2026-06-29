// LinkUpNaija — daily event-reminder Edge Function.
//
// Runs once a day, finds events happening *tomorrow*, and emails every
// accepted attendee a reminder via Resend.
//
// Deploy:
//   supabase functions deploy send-event-reminders
//
// Set secrets (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected
// automatically; you only need to add Resend + the From address):
//   supabase secrets set RESEND_API_KEY=re_xxx REMINDER_FROM="LinkUpNaija <support@linkupnaija.com>"
//
// Schedule it daily (e.g. 08:00 UTC) with pg_cron + pg_net in the SQL editor:
//   select cron.schedule(
//     'event-reminders-daily', '0 8 * * *',
//     $$ select net.http_post(
//          url := 'https://<project-ref>.supabase.co/functions/v1/send-event-reminders',
//          headers := jsonb_build_object(
//            'Content-Type','application/json',
//            'Authorization','Bearer <SUPABASE_SERVICE_ROLE_KEY>')
//        ); $$
//   );

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AttendeeRow {
  users: { email: string | null; name: string | null } | null;
}

interface EventRow {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  state: string;
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from =
    Deno.env.get("REMINDER_FROM") ?? "LinkUpNaija <support@linkupnaija.com>";

  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Tomorrow's date (YYYY-MM-DD), based on UTC.
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, date, time, location, state")
    .eq("date", dateStr);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;

  for (const event of (events ?? []) as EventRow[]) {
    const { data: attendees } = await supabase
      .from("rsvps")
      .select("users(email, name)")
      .eq("event_id", event.id)
      .eq("status", "accepted");

    for (const row of (attendees ?? []) as unknown as AttendeeRow[]) {
      const email = row.users?.email;
      if (!email) continue;

      const firstName = (row.users?.name ?? "there").split(" ")[0];
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#534AB7">See you tomorrow, ${firstName}! 🎉</h2>
          <p>This is a friendly reminder that you're going to:</p>
          <div style="border:1px solid #eee;border-radius:12px;padding:16px">
            <h3 style="margin:0 0 8px">${event.title}</h3>
            <p style="margin:4px 0">📅 ${event.date} at ${event.time}</p>
            <p style="margin:4px 0">📍 ${event.location}, ${event.state}</p>
          </div>
          <p style="color:#888;font-size:13px;margin-top:16px">
            See you there — from your friends at LinkUpNaija 💜
          </p>
        </div>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: email,
          subject: `Reminder: "${event.title}" is tomorrow!`,
          html,
        }),
      });
      if (res.ok) sent++;
    }
  }

  return new Response(
    JSON.stringify({ events: events?.length ?? 0, emailsSent: sent }),
    { headers: { "Content-Type": "application/json" } }
  );
});

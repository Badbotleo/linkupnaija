// LinkUpNaija — daily event-reminder Edge Function.
//
// Runs once a day, finds events happening *tomorrow* (the next 24h window for a
// daily job), and emails every accepted attendee a branded reminder via Resend.
//
// Deploy:
//   supabase functions deploy send-event-reminders
//
// Set secrets (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected
// automatically; you only need to add Resend + the From address):
//   supabase secrets set RESEND_API_KEY=re_xxx REMINDER_FROM="LinkUpNaija <support@linkupnaija.com>"
//
// Scheduled daily via pg_cron — see supabase/migration-retention.sql.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  emailLayout,
  heading,
  paragraph,
  eventCardHtml,
  firstName,
  escapeHtml,
  sendEmail,
} from "../_shared/email.ts";

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

  if (!Deno.env.get("RESEND_API_KEY")) {
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

      const html = emailLayout({
        title: `Reminder: ${event.title} is tomorrow`,
        preheader: `See you tomorrow at ${event.title}!`,
        bodyHtml: `
          ${heading(`See you tomorrow, ${escapeHtml(firstName(row.users?.name))}! 🎉`)}
          ${paragraph("This is a friendly reminder that you're going to:")}
          ${eventCardHtml(event)}
          ${paragraph("Have a great time — your friends at LinkUpNaija 💜")}
        `,
      });

      if (
        await sendEmail({
          to: email,
          subject: `Reminder: "${event.title}" is tomorrow!`,
          html,
        })
      ) {
        sent++;
      }
    }
  }

  return new Response(
    JSON.stringify({ events: events?.length ?? 0, emailsSent: sent }),
    { headers: { "Content-Type": "application/json" } }
  );
});

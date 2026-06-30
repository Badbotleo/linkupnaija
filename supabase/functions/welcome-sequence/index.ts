// LinkUpNaija — welcome sequence.
//
// Called once per newly-verified user. Sends the immediate "Welcome" email and
// schedules the day-2 / day-3 / day-5 follow-ups in `scheduled_emails`, which
// the daily `send-scheduled-emails` cron then processes.
//
// Trigger it from a Postgres trigger on auth.users (see migration-retention.sql)
// or call manually:
//   curl -X POST https://<ref>.functions.supabase.co/welcome-sequence \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
//     -H "Content-Type: application/json" -d '{"user_id":"<uuid>"}'
//
// Deploy: supabase functions deploy welcome-sequence

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SITE_URL,
  emailLayout,
  heading,
  paragraph,
  button,
  eventCardHtml,
  firstName,
  sendEmail,
  type EmailEvent,
} from "../_shared/email.ts";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Accept { user_id } or a DB-webhook style { record: { id } } / { type, record }.
  let userId: string | undefined;
  try {
    const body = await req.json();
    userId = body.user_id ?? body.record?.id ?? body.id;
  } catch {
    /* no body */
  }
  if (!userId) {
    return json({ error: "user_id required" }, 400);
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, name, email, state")
    .eq("id", userId)
    .single();

  if (!user?.email) {
    return json({ error: "user not found or has no email" }, 404);
  }

  // Idempotency: if we've already started this user's sequence, do nothing.
  const { data: existing } = await supabase
    .from("scheduled_emails")
    .select("id")
    .eq("user_id", user.id)
    .eq("email_type", "welcome")
    .limit(1);
  if (existing && existing.length) {
    return json({ skipped: "already processed" });
  }

  // Ensure an email_preferences row exists; respect an opt-out.
  await supabase
    .from("email_preferences")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: prefs } = await supabase
    .from("email_preferences")
    .select("welcome_emails_enabled")
    .eq("user_id", user.id)
    .single();

  if (prefs && prefs.welcome_emails_enabled === false) {
    return json({ skipped: "welcome emails disabled" });
  }

  // 3 real upcoming events in their state (if any).
  const today = new Date().toISOString().slice(0, 10);
  let events: EmailEvent[] = [];
  if (user.state) {
    const { data } = await supabase
      .from("events")
      .select("id, title, date, time, location, state")
      .eq("event_type", "general")
      .eq("state", user.state)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(3);
    events = (data ?? []) as EmailEvent[];
  }

  const name = firstName(user.name);
  const eventsBlock = events.length
    ? `<p style="margin:18px 0 10px;color:#1A1040;font-size:15px;font-weight:700">
         Happening soon in ${escapeState(user.state)} 👇
       </p>${events.map(eventCardHtml).join("")}`
    : "";

  const html = emailLayout({
    title: "Welcome to LinkUpNaija",
    preheader: "Find your people and your next outing.",
    bodyHtml: `
      ${heading(`Welcome to LinkUpNaija, ${escapeState(name)}! 🎉`)}
      ${paragraph(
        "We're buzzing to have you. LinkUpNaija is where Nigerians find hangouts, parties, picnics, game nights and more — or host their own."
      )}
      ${paragraph("Here's how to get started:")}
      ${button(`${SITE_URL}/events`, "🔎 Browse events")}
      ${button(`${SITE_URL}/host`, "🎤 Host an event")}
      ${button(`${SITE_URL}/profile/edit`, "✨ Complete your profile")}
      ${eventsBlock}
    `,
  });

  const ok = await sendEmail({
    to: user.email,
    subject: "Welcome to LinkUpNaija 💜",
    html,
  });

  // Record the welcome and schedule the follow-ups (idempotent on user+type).
  const now = new Date();
  const plus = (days: number) =>
    new Date(now.getTime() + days * 86400000).toISOString();

  await supabase.from("scheduled_emails").upsert(
    [
      {
        user_id: user.id,
        email_type: "welcome",
        scheduled_for: now.toISOString(),
        sent_at: ok ? now.toISOString() : null,
        status: ok ? "sent" : "failed",
      },
      {
        user_id: user.id,
        email_type: "day2_events",
        scheduled_for: plus(2),
        status: "pending",
      },
      {
        user_id: user.id,
        email_type: "profile_nudge",
        scheduled_for: plus(3),
        status: "pending",
      },
      {
        user_id: user.id,
        email_type: "host_nudge",
        scheduled_for: plus(5),
        status: "pending",
      },
    ],
    { onConflict: "user_id,email_type", ignoreDuplicates: true }
  );

  return json({ welcomeSent: ok, scheduled: ["day2_events", "profile_nudge", "host_nudge"] });
});

function escapeState(s: string | null): string {
  return (s ?? "").replace(/[<>&"']/g, "");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

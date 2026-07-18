// LinkUpNaija — daily scheduled-email processor.
//
// Runs once a day. Two jobs:
//  1) Process due rows in `scheduled_emails` (day-2 events, profile nudge,
//     host nudge) — re-checking the condition at send time so we never nudge
//     someone who already did the thing.
//  2) Re-engage users inactive 3+ days with "new events near you" (max once
//     per 7 days, tracked via a `reengagement` row in scheduled_emails).
//
// Deploy: supabase functions deploy send-scheduled-emails
// Schedule: see migration-retention.sql (pg_cron, daily).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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
import { founderEmailHtml, FOUNDER_SUBJECT } from "../_shared/founder.ts";

const REENGAGE_AFTER_DAYS = 3;
const REENGAGE_COOLDOWN_DAYS = 7;

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const result = {
    founder_intro: 0,
    day2_events: 0,
    profile_nudge: 0,
    host_nudge: 0,
    skipped: 0,
    reengagement: 0,
  };

  // --- 1) Due scheduled follow-ups -----------------------------------------
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("scheduled_emails")
    .select("id, user_id, email_type")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .limit(500);

  for (const row of due ?? []) {
    const { data: user } = await supabase
      .from("users")
      .select("id, name, email, state, bio, avatar_url")
      .eq("id", row.user_id)
      .single();

    if (!user?.email || !(await welcomeEnabled(supabase, user.id))) {
      await mark(supabase, row.id, "skipped");
      result.skipped++;
      continue;
    }

    let outcome: "sent" | "skipped" = "skipped";

    if (row.email_type === "founder_intro") {
      // One-time founder hello — always send (no re-check condition).
      const unsubscribeUrl = await unsubUrl(supabase, user.id);
      outcome = (await sendEmail({
        to: user.email,
        subject: FOUNDER_SUBJECT,
        html: founderEmailHtml({ name: user.name, unsubscribeUrl }),
      }))
        ? "sent"
        : "skipped";
    } else if (row.email_type === "day2_events") {
      if (!(await hasJoined(supabase, user.id))) {
        outcome = (await sendEventsEmail(supabase, user, {
          subject: "Haven't found your vibe yet? 👀",
          title: "Haven't found your vibe yet?",
          intro:
            "There's always something happening on LinkUpNaija. Here are a few link-ups coming up. Tap any to join in.",
          limit: 5,
        }))
          ? "sent"
          : "skipped";
      }
    } else if (row.email_type === "profile_nudge") {
      const incomplete = !user.bio || !user.avatar_url;
      if (incomplete) {
        outcome = (await sendProfileNudge(user)) ? "sent" : "skipped";
      }
    } else if (row.email_type === "host_nudge") {
      const joined = await hasJoined(supabase, user.id);
      const hosted = await hasHosted(supabase, user.id);
      if (!joined && !hosted) {
        outcome = (await sendHostNudge(user)) ? "sent" : "skipped";
      }
    }

    await mark(supabase, row.id, outcome);
    if (outcome === "sent") result[row.email_type as keyof typeof result]++;
    else result.skipped++;
  }

  // --- 2) Re-engagement for dormant users ----------------------------------
  const cutoff = new Date(
    Date.now() - REENGAGE_AFTER_DAYS * 86400000
  ).toISOString();
  const { data: dormant } = await supabase
    .from("users")
    .select("id, name, email, state, last_login_at")
    .not("last_login_at", "is", null)
    .lt("last_login_at", cutoff)
    .limit(500);

  for (const user of dormant ?? []) {
    if (!user.email || !(await welcomeEnabled(supabase, user.id))) continue;

    // Cooldown: skip if we re-engaged them within the last 7 days.
    const cooldown = new Date(
      Date.now() - REENGAGE_COOLDOWN_DAYS * 86400000
    ).toISOString();
    const { data: recent } = await supabase
      .from("scheduled_emails")
      .select("id")
      .eq("user_id", user.id)
      .eq("email_type", "reengagement")
      .gte("sent_at", cooldown)
      .limit(1);
    if (recent && recent.length) continue;

    const ok = await sendEventsEmail(supabase, user, {
      subject: "New events just dropped near you 👀",
      title: "New events just dropped near you 👀",
      intro: "We've missed you! Here's what's fresh on LinkUpNaija.",
      limit: 3,
      recent: true,
    });
    if (ok) {
      // Single reengagement row per user, refreshed each send (cooldown above).
      await supabase.from("scheduled_emails").upsert(
        {
          user_id: user.id,
          email_type: "reengagement",
          scheduled_for: nowIso,
          sent_at: nowIso,
          status: "sent",
        },
        { onConflict: "user_id,email_type" }
      );
      result.reengagement++;
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});

// --- helpers ---------------------------------------------------------------

interface UserLite {
  id: string;
  name: string | null;
  email: string;
  state: string | null;
}

async function welcomeEnabled(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("email_preferences")
    .select("welcome_emails_enabled")
    .eq("user_id", userId)
    .single();
  return !data || data.welcome_emails_enabled !== false;
}

async function hasJoined(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("rsvps")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

async function hasHosted(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("host_id", userId);
  return (count ?? 0) > 0;
}

async function upcomingEvents(
  supabase: SupabaseClient,
  state: string | null,
  limit: number,
  recent = false
): Promise<EmailEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase
    .from("events")
    .select("id, title, date, time, location, state, created_at")
    .eq("event_type", "general")
    .gte("date", today);
  if (state) q = q.eq("state", state);
  q = recent
    ? q.order("created_at", { ascending: false })
    : q.order("date", { ascending: true });
  const { data } = await q.limit(limit);
  let events = (data ?? []) as EmailEvent[];

  // Fall back to nationwide events if their state has none.
  if (events.length === 0 && state) {
    const { data: fallback } = await supabase
      .from("events")
      .select("id, title, date, time, location, state")
      .eq("event_type", "general")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(limit);
    events = (fallback ?? []) as EmailEvent[];
  }
  return events;
}

async function sendEventsEmail(
  supabase: SupabaseClient,
  user: UserLite,
  opts: {
    subject: string;
    title: string;
    intro: string;
    limit: number;
    recent?: boolean;
  }
): Promise<boolean> {
  const events = await upcomingEvents(supabase, user.state, opts.limit, opts.recent);
  if (events.length === 0) return false; // nothing to show — don't send an empty email

  const html = emailLayout({
    title: opts.title,
    preheader: opts.intro,
    bodyHtml: `
      ${heading(`Hey ${clean(firstName(user.name))} 👋`)}
      ${paragraph(opts.intro)}
      ${events.map(eventCardHtml).join("")}
      ${button(`${SITE_URL}/events`, "Browse all events")}
    `,
    unsubscribeUrl: await unsubUrl(supabase, user.id),
  });
  return sendEmail({ to: user.email, subject: opts.subject, html });
}

async function sendProfileNudge(user: {
  id: string;
  name: string | null;
  email: string;
}): Promise<boolean> {
  const html = emailLayout({
    title: "Complete your profile",
    preheader: "A complete profile gets more event invites.",
    bodyHtml: `
      ${heading("Complete your profile to get more invites ✨")}
      ${paragraph(
        `Hey ${clean(firstName(user.name))}, hosts are far more likely to approve people with a photo and a short bio. It takes 30 seconds:`
      )}
      ${paragraph(
        "• Add a profile photo<br/>• Write a one-line bio<br/>• Tell us your state"
      )}
      ${button(`${SITE_URL}/profile/edit`, "Complete my profile")}
    `,
  });
  return sendEmail({
    to: user.email,
    subject: "Complete your profile to get more event invites",
    html,
  });
}

async function sendHostNudge(user: {
  id: string;
  name: string | null;
  email: string;
}): Promise<boolean> {
  const html = emailLayout({
    title: "Want to host your own event?",
    preheader: "Hosting on LinkUpNaija is free and takes 2 minutes.",
    bodyHtml: `
      ${heading("Want to host your own event? 🎤")}
      ${paragraph(
        `Hey ${clean(firstName(user.name))}, couldn't find the perfect link-up? Create your own. It's free and takes about 2 minutes.`
      )}
      ${paragraph(
        "1. Give it a title and pick a vibe<br/>2. Set the date, time and location<br/>3. Share it and watch people join"
      )}
      ${button(`${SITE_URL}/host`, "Host an event")}
    `,
  });
  return sendEmail({
    to: user.email,
    subject: "Want to host your own event?",
    html,
  });
}

async function unsubUrl(
  supabase: SupabaseClient,
  userId: string
): Promise<string | undefined> {
  await supabase
    .from("email_preferences")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data } = await supabase
    .from("email_preferences")
    .select("unsubscribe_token")
    .eq("user_id", userId)
    .single();
  return data?.unsubscribe_token
    ? `${SITE_URL}/unsubscribe/${data.unsubscribe_token}`
    : undefined;
}

async function mark(
  supabase: SupabaseClient,
  id: string,
  status: "sent" | "skipped" | "failed"
): Promise<void> {
  await supabase
    .from("scheduled_emails")
    .update({ status, sent_at: status === "sent" ? new Date().toISOString() : null })
    .eq("id", id);
}

function clean(s: string): string {
  return s.replace(/[<>&"']/g, "");
}

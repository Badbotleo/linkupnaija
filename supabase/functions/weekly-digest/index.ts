// LinkUpNaija — weekly digest ("This week on LinkUpNaija").
//
// Runs every Thursday 09:00. Pulls events in the next 7 days, then emails each
// verified, opted-in user a digest showing events in *their* state first,
// followed by a sample from elsewhere. Includes an unsubscribe link.
//
// Deploy: supabase functions deploy weekly-digest
// Schedule: see migration-retention.sql (pg_cron, Thursdays 09:00).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SITE_URL,
  emailLayout,
  heading,
  paragraph,
  button,
  eventCardHtml,
  firstName,
  escapeHtml,
  sendEmail,
  type EmailEvent,
} from "../_shared/email.ts";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Events happening in the next 7 days.
  const today = new Date();
  const weekEnd = new Date(today.getTime() + 7 * 86400000);
  const from = today.toISOString().slice(0, 10);
  const to = weekEnd.toISOString().slice(0, 10);

  const { data: eventRows } = await supabase
    .from("events")
    .select("id, title, date, time, location, state")
    .eq("event_type", "general")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  const events = (eventRows ?? []) as EmailEvent[];
  if (events.length === 0) {
    return json({ skipped: "no events in the next 7 days" });
  }

  // Group by state for quick per-user assembly.
  const byState = new Map<string, EmailEvent[]>();
  for (const e of events) {
    const key = e.state ?? "Other";
    const arr = byState.get(key) ?? [];
    arr.push(e);
    byState.set(key, arr);
  }

  const confirmed = await confirmedUserIds(supabase);

  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, state");

  let sent = 0;
  let skipped = 0;

  for (const user of users ?? []) {
    if (!user.email || !confirmed.has(user.id)) {
      skipped++;
      continue;
    }

    // Ensure prefs row + respect opt-out.
    await supabase
      .from("email_preferences")
      .upsert(
        { user_id: user.id },
        { onConflict: "user_id", ignoreDuplicates: true }
      );
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("weekly_digest_enabled, unsubscribe_token")
      .eq("user_id", user.id)
      .single();
    if (prefs && prefs.weekly_digest_enabled === false) {
      skipped++;
      continue;
    }

    const mine = user.state ? byState.get(user.state) ?? [] : [];
    const others = events
      .filter((e) => e.state !== user.state)
      .slice(0, 4);

    const sections: string[] = [];
    if (mine.length) {
      sections.push(
        `<p style="margin:18px 0 10px;color:#1A1040;font-size:15px;font-weight:700">
           📍 In ${escapeHtml(user.state ?? "")} this week
         </p>${mine.slice(0, 6).map(eventCardHtml).join("")}`
      );
    }
    if (others.length) {
      sections.push(
        `<p style="margin:18px 0 10px;color:#1A1040;font-size:15px;font-weight:700">
           ✨ Also happening across Nigeria
         </p>${others.map(eventCardHtml).join("")}`
      );
    }
    if (sections.length === 0) {
      skipped++;
      continue;
    }

    const unsubscribeUrl = prefs?.unsubscribe_token
      ? `${SITE_URL}/unsubscribe/${prefs.unsubscribe_token}`
      : undefined;

    const html = emailLayout({
      title: "This week on LinkUpNaija",
      preheader: `${events.length} events happening across Nigeria this week.`,
      bodyHtml: `
        ${heading(`This week on LinkUpNaija 🗓️`)}
        ${paragraph(
          `Hey ${escapeHtml(firstName(user.name))}, here's what's happening over the next 7 days.`
        )}
        ${sections.join("")}
        ${button(`${SITE_URL}/events`, "See all events")}
      `,
      unsubscribeUrl,
    });

    if (await sendEmail({ to: user.email, subject: "This week on LinkUpNaija 🗓️", html })) {
      sent++;
    } else {
      skipped++;
    }
  }

  return json({ events: events.length, sent, skipped });
});

/** Set of auth user ids whose email is confirmed. */
async function confirmedUserIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  // Page through the admin user list (1000/page).
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if (u.email_confirmed_at) ids.add(u.id);
    }
    if (data.users.length < 1000) break;
    page++;
  }
  return ids;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

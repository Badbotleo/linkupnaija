// LinkUpNaija — one-off reminder broadcast to all users.
//
// Sends a branded "come back & check what's happening" reminder to every user,
// with up to 3 upcoming events in their state. Re-engagement style, so it
// respects the weekly-digest opt-out and includes an unsubscribe link.
//
// Idempotent + resumable: each send is tracked in `scheduled_emails` under a
// per-campaign email_type ("broadcast:<campaign>"), so re-running only emails
// people who haven't been sent this campaign yet. Change {"campaign":"..."} to
// start a fresh broadcast to everyone again.
//
// Deploy:  supabase functions deploy send-broadcast
//
// Usage (send the service-role key as the Bearer token):
//   # 1) Preview the audience — no emails sent:
//   curl -X POST https://<ref>.functions.supabase.co/send-broadcast \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
//     -H "Content-Type: application/json" -d '{"dry_run":true}'
//
//   # 2) Send one test to yourself first — no DB writes:
//   curl -X POST .../send-broadcast -H "Authorization: Bearer <KEY>" \
//     -H "Content-Type: application/json" -d '{"test_to":"you@example.com"}'
//
//   # 3) Run it for real (one batch per call), repeat until remaining=0:
//   curl -X POST .../send-broadcast -H "Authorization: Bearer <KEY>" \
//     -H "Content-Type: application/json" -d '{}'
//
//   Optional body fields:
//     {"subject":"...", "campaign":"jul-2026", "batch":100}

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  emailLayout,
  heading,
  paragraph,
  button,
  eventCardHtml,
  firstName,
  escapeHtml,
  sendEmail,
  SITE_URL,
  type EmailEvent,
} from "../_shared/email.ts";

const DEFAULT_BATCH = 75;
const SEND_SPACING_MS = 350; // ~3 emails/sec — under Resend's rate limit
const DEFAULT_SUBJECT = "Your next link-up is waiting 👀";
const DEFAULT_CAMPAIGN = "reminder";

function reminderEmailHtml(opts: {
  name: string | null;
  state: string | null;
  events: EmailEvent[];
  unsubscribeUrl?: string;
}): string {
  const eventsBlock = opts.events.length
    ? `<p style="margin:18px 0 10px;color:#1A1040;font-size:15px;font-weight:700">
         Happening soon${opts.state ? ` in ${escapeHtml(opts.state)}` : ""} 👇
       </p>${opts.events.map(eventCardHtml).join("")}`
    : "";
  return emailLayout({
    title: "Your next link-up is waiting",
    preheader: "New hangouts, parties and picnics are popping up near you.",
    unsubscribeUrl: opts.unsubscribeUrl,
    bodyHtml: `
      ${heading(`Hey ${firstName(opts.name)}, we've missed you 👋`)}
      ${paragraph(
        "Nigerians are linking up on LinkUpNaija every week — hangouts, parties, picnics, game nights and more. Here's your nudge to jump back in and find your people."
      )}
      ${button(`${SITE_URL}/events`, "🔎 See what's happening")}
      ${button(`${SITE_URL}/host`, "🎤 Host your own")}
      ${eventsBlock}
    `,
  });
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body = real run */
  }

  const subject =
    typeof body.subject === "string" && body.subject.trim()
      ? body.subject.trim()
      : DEFAULT_SUBJECT;
  const campaign =
    typeof body.campaign === "string" && body.campaign.trim()
      ? body.campaign.trim()
      : DEFAULT_CAMPAIGN;
  const emailType = `broadcast:${campaign}`;

  // --- Test mode: send one sample, no DB writes ----------------------------
  if (typeof body.test_to === "string") {
    const ok = await sendEmail({
      to: body.test_to,
      subject,
      html: reminderEmailHtml({ name: "there", state: null, events: [] }),
    });
    return json({ test_to: body.test_to, campaign, sent: ok });
  }

  // --- Build the eligible set (everyone not yet sent THIS campaign) ---------
  const alreadySent = await collectSent(supabase, emailType);
  const users = await collectUsers(supabase);
  const eligible = users.filter((u) => u.email && !alreadySent.has(u.id));

  if (body.dry_run === true) {
    return json({
      campaign,
      subject,
      total_users: users.length,
      already_sent: alreadySent.size,
      eligible: eligible.length,
    });
  }

  const batchSize =
    typeof body.batch === "number" && body.batch > 0
      ? Math.min(body.batch, 200)
      : DEFAULT_BATCH;
  const batch = eligible.slice(0, batchSize);

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;
  let skippedOptOut = 0;
  let failed = 0;

  for (const user of batch) {
    // Ensure a prefs row + respect the re-engagement opt-out.
    await supabase
      .from("email_preferences")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("weekly_digest_enabled, unsubscribe_token")
      .eq("user_id", user.id)
      .single();

    if (prefs && prefs.weekly_digest_enabled === false) {
      // Mark processed so future runs skip them without re-checking.
      await supabase.from("scheduled_emails").upsert(
        {
          user_id: user.id,
          email_type: emailType,
          scheduled_for: new Date().toISOString(),
          status: "skipped",
        },
        { onConflict: "user_id,email_type", ignoreDuplicates: true }
      );
      skippedOptOut++;
      continue;
    }

    // Up to 3 upcoming events in their state.
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

    const unsubscribeUrl = prefs?.unsubscribe_token
      ? `${SITE_URL}/unsubscribe/${prefs.unsubscribe_token}`
      : undefined;

    const ok = await sendEmail({
      to: user.email,
      subject,
      html: reminderEmailHtml({
        name: user.name,
        state: user.state,
        events,
        unsubscribeUrl,
      }),
    });
    if (ok) sent++;
    else failed++;

    // Record the send (idempotent on user+type) so re-runs don't double-send.
    const now = new Date().toISOString();
    await supabase.from("scheduled_emails").upsert(
      {
        user_id: user.id,
        email_type: emailType,
        scheduled_for: now,
        sent_at: ok ? now : null,
        status: ok ? "sent" : "failed",
      },
      { onConflict: "user_id,email_type", ignoreDuplicates: true }
    );

    await sleep(SEND_SPACING_MS);
  }

  return json({
    campaign,
    processed: batch.length,
    sent,
    failed,
    skipped_opted_out: skippedOptOut,
    remaining: Math.max(0, eligible.length - batch.length),
  });
});

interface UserLite {
  id: string;
  name: string | null;
  email: string;
  state: string | null;
}

async function collectSent(
  supabase: SupabaseClient,
  emailType: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("scheduled_emails")
      .select("user_id")
      .eq("email_type", emailType)
      .range(offset, offset + PAGE - 1);
    if (error || !data?.length) break;
    for (const r of data) ids.add(r.user_id as string);
    if (data.length < PAGE) break;
  }
  return ids;
}

async function collectUsers(supabase: SupabaseClient): Promise<UserLite[]> {
  const out: UserLite[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, state")
      .range(offset, offset + PAGE - 1);
    if (error || !data?.length) break;
    out.push(...(data as UserLite[]));
    if (data.length < PAGE) break;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

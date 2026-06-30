// LinkUpNaija — one-time welcome backfill.
//
// Sends the "Welcome to LinkUpNaija" email to every existing user who hasn't
// already received one, and starts their day-2 / day-3 / day-5 follow-up
// sequence. Safe to run repeatedly: it skips anyone already processed (tracked
// via a `welcome` row in scheduled_emails), so you just re-run until
// "remaining" is 0.
//
// Deploy:  supabase functions deploy send-welcome-all
//
// Usage (send the service-role key as the Bearer token):
//   # 1) Preview how many will be emailed — no emails sent:
//   curl -X POST https://<ref>.functions.supabase.co/send-welcome-all \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
//     -H "Content-Type: application/json" -d '{"dry_run":true}'
//
//   # 2) Send a single test to yourself first — no DB writes:
//   curl -X POST .../send-welcome-all -H "Authorization: Bearer <KEY>" \
//     -H "Content-Type: application/json" -d '{"test_to":"you@example.com"}'
//
//   # 3) Run the real backfill (one batch per call), repeat until remaining=0:
//   curl -X POST .../send-welcome-all -H "Authorization: Bearer <KEY>" \
//     -H "Content-Type: application/json" -d '{}'

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  welcomeEmailHtml,
  sendEmail,
  type EmailEvent,
} from "../_shared/email.ts";

// Sent per invocation. Keeps us under Resend's rate limit and the function's
// wall-clock limit; re-invoke to continue. Override with {"batch": N}.
const DEFAULT_BATCH = 75;
const SEND_SPACING_MS = 350; // ~3 emails/sec

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

  // --- Test mode: send one sample welcome, no DB writes --------------------
  if (typeof body.test_to === "string") {
    const ok = await sendEmail({
      to: body.test_to,
      subject: "Welcome to LinkUpNaija 💜",
      html: welcomeEmailHtml({ name: "there", state: null, events: [] }),
    });
    return json({ test_to: body.test_to, sent: ok });
  }

  // --- Build the eligible set ---------------------------------------------
  const welcomed = await collectWelcomed(supabase);
  const users = await collectUsers(supabase);
  const eligible = users.filter((u) => u.email && !welcomed.has(u.id));

  if (body.dry_run === true) {
    return json({
      total_users: users.length,
      already_welcomed: welcomed.size,
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
    // Ensure a prefs row + respect opt-out.
    await supabase
      .from("email_preferences")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("welcome_emails_enabled")
      .eq("user_id", user.id)
      .single();

    if (prefs && prefs.welcome_emails_enabled === false) {
      // Mark processed so we don't keep re-checking them on future runs.
      await supabase.from("scheduled_emails").upsert(
        {
          user_id: user.id,
          email_type: "welcome",
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

    const ok = await sendEmail({
      to: user.email,
      subject: "Welcome to LinkUpNaija 💜",
      html: welcomeEmailHtml({ name: user.name, state: user.state, events }),
    });
    if (ok) sent++;
    else failed++;

    // Record welcome + schedule the follow-ups (idempotent on user+type).
    const now = new Date();
    const plus = (d: number) =>
      new Date(now.getTime() + d * 86400000).toISOString();
    await supabase.from("scheduled_emails").upsert(
      [
        {
          user_id: user.id,
          email_type: "welcome",
          scheduled_for: now.toISOString(),
          sent_at: ok ? now.toISOString() : null,
          status: ok ? "sent" : "failed",
        },
        { user_id: user.id, email_type: "day2_events", scheduled_for: plus(2), status: "pending" },
        { user_id: user.id, email_type: "profile_nudge", scheduled_for: plus(3), status: "pending" },
        { user_id: user.id, email_type: "host_nudge", scheduled_for: plus(5), status: "pending" },
      ],
      { onConflict: "user_id,email_type", ignoreDuplicates: true }
    );

    await sleep(SEND_SPACING_MS);
  }

  return json({
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

async function collectWelcomed(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("scheduled_emails")
      .select("user_id")
      .eq("email_type", "welcome")
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

// LinkUpNaija — one-time founder introduction from Leo.
//
// Two modes:
//   {"user_id":"<uuid>"}  → send to one user (used by the day-after-welcome
//                           step in send-scheduled-emails). Idempotent.
//   {}                    → backfill: send to every existing user who hasn't
//                           had it yet. Batched + resumable.
//
// Respects the weekly-digest opt-out and includes an unsubscribe link. Tracked
// per user via a "founder_intro" row in scheduled_emails so nobody gets it
// twice (a new user who received it via the sequence is skipped by the
// backfill, and vice-versa).
//
// Deploy:  supabase functions deploy send-founder-intro
//
// Manual:
//   {"test_to":"you@x.com"}   → one sample, no writes
//   {"dry_run":true}          → audience count
//   {}                        → real backfill, one batch; repeat until remaining=0

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, SITE_URL } from "../_shared/email.ts";
import { founderEmailHtml, FOUNDER_SUBJECT } from "../_shared/founder.ts";

const EMAIL_TYPE = "founder_intro";
const DEFAULT_BATCH = 300;
const SEND_SPACING_MS = 250;

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body = backfill */
  }

  // --- Test mode -----------------------------------------------------------
  if (typeof body.test_to === "string") {
    const ok = await sendEmail({
      to: body.test_to,
      subject: FOUNDER_SUBJECT,
      html: founderEmailHtml({ name: "there" }),
    });
    return json({ test_to: body.test_to, sent: ok });
  }

  // --- Single user (day-after-welcome step) --------------------------------
  if (typeof body.user_id === "string") {
    const result = await sendToUser(supabase, body.user_id);
    return json(result);
  }

  // --- Backfill: every user not yet sent -----------------------------------
  const alreadySent = await collectSent(supabase);
  const users = await collectUsers(supabase);
  const eligible = users.filter((u) => u.email && !alreadySent.has(u.id));

  if (body.dry_run === true) {
    return json({
      total_users: users.length,
      already_sent: alreadySent.size,
      eligible: eligible.length,
    });
  }

  const batchSize =
    typeof body.batch === "number" && body.batch > 0
      ? Math.min(body.batch, 500)
      : DEFAULT_BATCH;
  const batch = eligible.slice(0, batchSize);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const u of batch) {
    const r = await sendToUser(supabase, u.id, u);
    if (r.sent) sent++;
    else if (r.skipped) skipped++;
    else failed++;
    await sleep(SEND_SPACING_MS);
  }

  return json({
    processed: batch.length,
    sent,
    skipped,
    failed,
    remaining: Math.max(0, eligible.length - batch.length),
  });
});

interface UserLite {
  id: string;
  name: string | null;
  email: string | null;
}

async function sendToUser(
  supabase: SupabaseClient,
  userId: string,
  prefetched?: UserLite
): Promise<{ sent: boolean; skipped?: boolean; reason?: string }> {
  const user =
    prefetched ??
    (
      await supabase
        .from("users")
        .select("id, name, email")
        .eq("id", userId)
        .single()
    ).data;
  if (!user?.email) return { sent: false, skipped: true, reason: "no email" };

  // Idempotency: already sent?
  const { data: existing } = await supabase
    .from("scheduled_emails")
    .select("id")
    .eq("user_id", userId)
    .eq("email_type", EMAIL_TYPE)
    .limit(1);
  if (existing && existing.length) {
    return { sent: false, skipped: true, reason: "already sent" };
  }

  // Prefs + opt-out.
  await supabase
    .from("email_preferences")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: prefs } = await supabase
    .from("email_preferences")
    .select("weekly_digest_enabled, unsubscribe_token")
    .eq("user_id", userId)
    .single();

  if (prefs && prefs.weekly_digest_enabled === false) {
    await supabase.from("scheduled_emails").upsert(
      { user_id: userId, email_type: EMAIL_TYPE, scheduled_for: new Date().toISOString(), status: "skipped" },
      { onConflict: "user_id,email_type", ignoreDuplicates: true }
    );
    return { sent: false, skipped: true, reason: "opted out" };
  }

  const unsubscribeUrl = prefs?.unsubscribe_token
    ? `${SITE_URL}/unsubscribe/${prefs.unsubscribe_token}`
    : undefined;

  const ok = await sendEmail({
    to: user.email,
    subject: FOUNDER_SUBJECT,
    html: founderEmailHtml({ name: user.name, unsubscribeUrl }),
  });

  const now = new Date().toISOString();
  await supabase.from("scheduled_emails").upsert(
    {
      user_id: userId,
      email_type: EMAIL_TYPE,
      scheduled_for: now,
      sent_at: ok ? now : null,
      status: ok ? "sent" : "failed",
    },
    { onConflict: "user_id,email_type", ignoreDuplicates: true }
  );

  return { sent: ok };
}

async function collectSent(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("scheduled_emails")
      .select("user_id")
      .eq("email_type", EMAIL_TYPE)
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
      .select("id, name, email")
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

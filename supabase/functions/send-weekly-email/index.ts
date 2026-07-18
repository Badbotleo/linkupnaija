// LinkUpNaija — recurring weekly email to all users.
//
// Rotates through several DISTINCT templates so consecutive weeks never send
// the same message. The template is chosen by ISO week number, so a weekly
// cron naturally cycles: week 1 → Discover, week 2 → Host, week 3 → Circles,
// week 4 → Weekend, week 5 → Friends, week 6 → Discover again, …
//
// Re-engagement style: respects the weekly-digest opt-out and includes an
// unsubscribe link. Idempotent + resumable per week via a
// "weekly:<key>:<year>w<week>" row in scheduled_emails, so a re-run in the
// same week only emails people who haven't been sent that week's template yet.
//
// Deploy:  supabase functions deploy send-weekly-email
//
// Schedule (pg_cron) — see the SQL block in migration-retention.sql notes.
//
// Manual usage (service-role key as Bearer):
//   {"dry_run":true}          → audience + which template fires this week
//   {"test_to":"you@x.com"}   → one sample of THIS week's template, no writes
//   {"template":"host"}       → force a specific template (testing)
//   {}                        → real send for this week, one batch; repeat.

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

const DEFAULT_BATCH = 300;
const SEND_SPACING_MS = 250; // ~4 emails/sec — under Resend's rate limit

interface Ctx {
  name: string | null;
  state: string | null;
  events: EmailEvent[];
  unsubscribeUrl?: string;
}
interface Template {
  key: string;
  subject: string;
  needsEvents: boolean;
  render: (c: Ctx) => string;
}

function eventsBlock(c: Ctx): string {
  if (!c.events.length) return "";
  return `<p style="margin:18px 0 10px;color:#1A1040;font-size:15px;font-weight:700">
      Happening soon${c.state ? ` in ${escapeHtml(c.state)}` : ""} 👇
    </p>${c.events.map(eventCardHtml).join("")}`;
}

// Rotation of distinct emails. Add/reorder freely — the cron cycles through them.
const TEMPLATES: Template[] = [
  {
    key: "discover",
    subject: "This week's link-ups near you 📍",
    needsEvents: true,
    render: (c) =>
      emailLayout({
        title: "This week's link-ups",
        preheader: "Fresh hangouts, parties and picnics are live.",
        unsubscribeUrl: c.unsubscribeUrl,
        bodyHtml: `
          ${heading(`New this week, ${firstName(c.name)} 👀`)}
          ${paragraph(
            "People across Nigeria are linking up: hangouts, parties, picnics and game nights. Here's a quick look at what's coming up so you don't miss out."
          )}
          ${button(`${SITE_URL}/events`, "🔎 Browse this week's events")}
          ${eventsBlock(c)}
        `,
      }),
  },
  {
    key: "host",
    subject: "Got a vibe? Host it 🎤",
    needsEvents: false,
    render: (c) =>
      emailLayout({
        title: "Host your own link-up",
        preheader: "Turn your idea into a hangout in minutes.",
        unsubscribeUrl: c.unsubscribeUrl,
        bodyHtml: `
          ${heading(`Ever thought about hosting, ${firstName(c.name)}?`)}
          ${paragraph(
            "The best link-ups start with one person and an idea: a picnic, a game night, a book club, a small party. Setting one up on LinkUpNaija takes a couple of minutes, and you decide who joins."
          )}
          ${paragraph("You bring the vibe. We'll help you gather your people.")}
          ${button(`${SITE_URL}/host`, "🎤 Host an event")}
        `,
      }),
  },
  {
    key: "circles",
    subject: "Find your people in a Circle ⭕",
    needsEvents: false,
    render: (c) =>
      emailLayout({
        title: "Join a Circle",
        preheader: "Communities built around what you love.",
        unsubscribeUrl: c.unsubscribeUrl,
        bodyHtml: `
          ${heading(`Your people are waiting, ${firstName(c.name)} ⭕`)}
          ${paragraph(
            "Circles are communities on LinkUpNaija built around a shared interest: a city, a hobby, a scene. Join one to meet regulars, chat, and hear about link-ups before anyone else."
          )}
          ${button(`${SITE_URL}/circles`, "⭕ Explore Circles")}
        `,
      }),
  },
  {
    key: "weekend",
    subject: "Plans this weekend? 🎉",
    needsEvents: true,
    render: (c) =>
      emailLayout({
        title: "Plans this weekend?",
        preheader: "Don't let another weekend go quietly.",
        unsubscribeUrl: c.unsubscribeUrl,
        bodyHtml: `
          ${heading(`Weekend loading, ${firstName(c.name)} 🎉`)}
          ${paragraph(
            "A free weekend is a terrible thing to waste. Whether you're after something lively or laid-back, there's a link-up for it near you."
          )}
          ${button(`${SITE_URL}/events`, "🎉 Find something to do")}
          ${eventsBlock(c)}
        `,
      }),
  },
  {
    key: "friends",
    subject: "Who are you linking up with? 👥",
    needsEvents: false,
    render: (c) =>
      emailLayout({
        title: "Bring your people",
        preheader: "Link-ups are better with friends.",
        unsubscribeUrl: c.unsubscribeUrl,
        bodyHtml: `
          ${heading(`Better together, ${firstName(c.name)} 👥`)}
          ${paragraph(
            "Everything on LinkUpNaija is more fun with people you know. Connect with friends, see what they're attending, and invite them to your next outing."
          )}
          ${button(`${SITE_URL}/friends`, "👥 Find friends")}
        `,
      }),
  },
];

function isoWeek(d: Date): { year: number; week: number } {
  // ISO-8601 week number (Mon-based). Stable, timezone-agnostic enough for a
  // weekly cadence.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
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

  // Pick this week's template (or a forced one for testing).
  const { year, week } = isoWeek(new Date());
  const forced =
    typeof body.template === "string"
      ? TEMPLATES.find((t) => t.key === body.template)
      : undefined;
  const tpl = forced ?? TEMPLATES[week % TEMPLATES.length];
  const emailType = `weekly:${tpl.key}:${year}w${week}`;

  // --- Test mode: one sample of this week's template, no DB writes ----------
  if (typeof body.test_to === "string") {
    const ok = await sendEmail({
      to: body.test_to,
      subject: tpl.subject,
      html: tpl.render({ name: "there", state: null, events: [] }),
    });
    return json({ template: tpl.key, subject: tpl.subject, test_to: body.test_to, sent: ok });
  }

  const alreadySent = await collectSent(supabase, emailType);
  const users = await collectUsers(supabase);
  const eligible = users.filter((u) => u.email && !alreadySent.has(u.id));

  if (body.dry_run === true) {
    return json({
      week: `${year}-W${week}`,
      template: tpl.key,
      subject: tpl.subject,
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

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;
  let skippedOptOut = 0;
  let failed = 0;

  for (const user of batch) {
    await supabase
      .from("email_preferences")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("weekly_digest_enabled, unsubscribe_token")
      .eq("user_id", user.id)
      .single();

    if (prefs && prefs.weekly_digest_enabled === false) {
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

    let events: EmailEvent[] = [];
    if (tpl.needsEvents && user.state) {
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
      subject: tpl.subject,
      html: tpl.render({ name: user.name, state: user.state, events, unsubscribeUrl }),
    });
    if (ok) sent++;
    else failed++;

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
    week: `${year}-W${week}`,
    template: tpl.key,
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

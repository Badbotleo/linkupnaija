import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import {
  MILESTONES,
  METRICS,
  OPERATING_PLAN,
  OPERATING_METRICS,
  OPERATING_BASELINE,
  currentMilestone,
  currentOperating,
  previousMilestone,
  verdict,
  verdictAtMost,
  type Verdict,
} from "@/lib/growth-plan";

export const dynamic = "force-dynamic";

/**
 * The 3-year plan, marked.
 *
 * The plan is a fourteen page PDF of checkboxes, and nothing in it was ever
 * checked against the database. This page does the one thing that makes a
 * target a target: it says, out loud, whether you hit it.
 *
 * ONLY THE MILESTONE YOU CAN STILL AFFECT. It shows the next one due and, if
 * one has already passed, what actually happened on that date. A wall of six
 * milestones is a wall nobody reads, and the Year 3 column is not a thing you
 * can act on this week.
 *
 * EVERY NUMBER IS MEASURED HERE, not typed in, except Instagram followers,
 * which the database has no way of knowing. That one is shown with its target
 * and no verdict rather than being quietly dropped, because a metric that
 * disappears when it is inconvenient is worse than one you have to check by
 * hand.
 *
 * The trailing window is 30 days everywhere. The plan says "monthly" without
 * defining it, and calendar months would make the first of the month look
 * like a collapse every time.
 */

const DAY = 86_400_000;

function naira(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}K`;
  return `₦${n.toLocaleString()}`;
}

function fmt(n: number, isNaira?: boolean): string {
  return isNaira ? naira(n) : n.toLocaleString();
}

const VERDICT_STYLE: Record<Verdict, { chip: string; bar: string; word: string }> = {
  hit: {
    chip: "bg-naija-50 text-naija-600",
    bar: "bg-naija-500",
    word: "Hit",
  },
  close: {
    chip: "bg-amber-50 text-amber-700",
    bar: "bg-amber-400",
    word: "Close",
  },
  behind: {
    chip: "bg-red-50 text-red-600",
    bar: "bg-red-400",
    word: "Behind",
  },
};

export default async function AdminGrowthPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/growth");

  /**
   * The one admin page a teammate can open.
   *
   * is_team grants this and nothing else. Asked for because Courage hosts
   * most of what happens here and should see what we are aiming at, and
   * is_admin would have handed him the payments desk, the support inbox,
   * every member's email and phone, and write access to half a dozen tables.
   *
   * Asked for with a fallback, because is_team arrives with
   * migration-team-flag.sql. Selecting a column that is not there yet fails
   * the whole query in PostgREST, which would lock the founder out of his own
   * page until the migration ran.
   */
  let { data: me, error: meError } = await supabase
    .from("users")
    .select("is_admin, is_team")
    .eq("id", user.id)
    .single();

  if (meError?.code === "42703" || meError?.code === "42501") {
    ({ data: me } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single());
  }

  const isAdmin = !!me?.is_admin;
  const onTeam = isAdmin || !!(me as { is_team?: boolean } | null)?.is_team;

  /**
   * A refusal that says which account it refused.
   *
   * This used to be notFound(), and a 404 on a page somebody has been
   * explicitly invited to is unhelpful to the point of being a bug: it cannot
   * distinguish "the flag was never set" from "you are signed in as the wrong
   * account", and we spent a day unable to tell which.
   *
   * The distinction is not hypothetical here. There are three accounts named
   * some version of Courage, two of them empty duplicate signups, and signing
   * in with either gives exactly the same blank 404 as a missing flag.
   *
   * So it names the account instead. Nothing on this screen is sensitive,
   * every visitor has already authenticated, and 404 as an access-denied is
   * only worth its cost when you are hiding that a page exists at all. We are
   * not; we sent them the link.
   */
  if (!onTeam) {
    const { data: whoami } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();

    return (
      <div className="pb-24">
        <AppHeader title="Growth plan" back />
        <div className="mx-auto max-w-md px-4 pt-10 text-center">
          <p className="text-[44px]">🔒</p>
          <h1 className="mt-2 text-[22px] font-extrabold text-gray-900 dark:text-white">
            This one is for the team
          </h1>
          <p className="mt-2 text-[15px] leading-snug text-gray-600 dark:text-white/70">
            You are signed in as{" "}
            <span className="font-bold text-gray-900 dark:text-white">
              {(whoami as { name?: string | null } | null)?.name ?? "an unnamed account"}
            </span>
            . That account does not have team access.
          </p>
          <p className="mt-4 rounded-2xl bg-gray-50 p-3.5 text-[13px] leading-snug text-gray-500 dark:bg-white/5">
            If you were expecting to get in, check you are signed in with the
            right account. It is easy to end up with two.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-[15px] font-bold text-white"
          >
            Back to LinkUpNaija
          </Link>
        </div>
      </div>
    );
  }

  const since = new Date(Date.now() - 30 * DAY).toISOString();

  const [usersRes, eventsRes, rsvpsRes, txRes, premiumRes] = await Promise.all([
    supabase.from("users").select("id, is_pro, pro_expires_at, is_admin, created_at, is_team"),
    supabase.from("events").select("id, created_at, host_id, state, is_listing, date, title"),
    supabase.from("rsvps").select("user_id, created_at, status, event_id"),
    supabase.from("transactions").select("amount, created_at"),
    supabase.from("premium_payments").select("amount, created_at, user_id, paystack_reference"),
  ]);

  const users = (usersRes.data ?? []) as {
    id: string;
    is_pro: boolean | null;
    pro_expires_at: string | null;
    is_admin: boolean | null;
    is_team?: boolean | null;
    created_at: string;
  }[];
  const events = (eventsRes.data ?? []) as {
    id: string;
    created_at: string;
    host_id: string;
    state: string | null;
    is_listing: boolean | null;
    date: string;
    title: string;
  }[];
  const rsvps = (rsvpsRes.data ?? []) as {
    user_id: string;
    created_at: string;
    status: string;
    event_id: string;
  }[];
  const tx = (txRes.data ?? []) as { amount: number | null; created_at: string }[];
  const premium = (premiumRes.data ?? []) as {
    amount: number | null;
    created_at: string;
    user_id: string;
    paystack_reference: string | null;
  }[];

  /**
   * Paid, not given.
   *
   * Eight accounts carry is_pro and seven of them were comped, so counting
   * is_pro as "subscribers" reports eight paying customers when there is one.
   * migration-premium-payments.sql notes that a hand-granted subscription has
   * no paystack_reference, which is what makes this checkable rather than
   * something you have to remember.
   *
   * The comped count is shown beside it rather than hidden, because giving
   * Pro away is a real thing you did and worth seeing.
   */
  const payingPro = new Set(
    premium.filter((p) => p.paystack_reference).map((p) => p.user_id)
  );

  const nowIso = new Date().toISOString();

  const compedPro = users.filter(
    (u) =>
      u.is_pro &&
      (!u.pro_expires_at || u.pro_expires_at > nowIso) &&
      !payingPro.has(u.id)
  ).length;

  // Hosted only. 181 of the events on this platform are admin listings, and
  // counting them as supply is how the one target that looks met gets met.
  const hosted = events.filter((e) => !e.is_listing);
  const hostedRecent = hosted.filter((e) => e.created_at >= since);

  const actual: Record<string, number> = {
    mau: new Set(rsvps.filter((r) => r.created_at >= since).map((r) => r.user_id)).size,
    revenue:
      tx.filter((t) => t.created_at >= since).reduce((a, t) => a + (t.amount ?? 0), 0) +
      premium.filter((p) => p.created_at >= since).reduce((a, p) => a + (p.amount ?? 0), 0),
    eventsPerMonth: hostedRecent.length,
    activeHosts: new Set(hostedRecent.map((e) => e.host_id)).size,
    proSubscribers: payingPro.size,
    cities: new Set(events.map((e) => e.state).filter(Boolean)).size,
    instagramFollowers: 0,
  };

  // How concentrated the supply is. Not a plan target, because the plan never
  // considered it, and it is the number that decides whether any of the
  // others are reachable.
  const perHost = new Map<string, number>();
  for (const e of hostedRecent) perHost.set(e.host_id, (perHost.get(e.host_id) ?? 0) + 1);
  const ranked = Array.from(perHost.values()).sort((a, b) => b - a);
  const top3 = ranked.slice(0, 3).reduce((a, b) => a + b, 0);
  const concentration = hostedRecent.length ? Math.round((top3 / hostedRecent.length) * 100) : 0;

  /* ------------------------------------------------ the operating plan ---- */
  /**
   * Who counts as the platform rather than a host on it.
   *
   * is_admin ALONE WAS WRONG, and the page caught it the first time anybody
   * looked at it. The account that created 47 of last month's 51 events is
   * not flagged is_admin, so it was counted as an outside host: "events they
   * created" read 50 of 10 and Hit, and "your share of events" read 4%
   * against a 70% cap. Both were the exact opposite of true, and this page
   * exists to stop that, so it had to be the definition that changed.
   *
   * ANYONE WHO IMPORTS LISTINGS IS OPERATING THE PLATFORM. is_listing events
   * are ones we added on somebody else's behalf, and only two accounts have
   * ever created one. Both are ours. No real host has, because a real host
   * posts their own night rather than bulk-importing other people's.
   *
   * So the rule is self-maintaining: it needs no UUID in the repo, no
   * hand-flagging, and it keeps working if the founder changes account,
   * because whichever account does the importing is by definition the one
   * running the platform. The page prints the count so it can be checked.
   */
  const staff = new Set([
    ...users.filter((u) => u.is_admin || u.is_team).map((u) => u.id),
    ...events.filter((e) => e.is_listing).map((e) => e.host_id),
  ]);
  const externalRecent = hostedRecent.filter((e) => !staff.has(e.host_id));
  const everRequested = new Set(rsvps.map((r) => r.user_id));
  const requestCount = new Map<string, number>();
  for (const r of rsvps) requestCount.set(r.user_id, (requestCount.get(r.user_id) ?? 0) + 1);
  const repeaters = Array.from(requestCount.values()).filter((n) => n > 1).length;

  const opActual: Record<string, number> = {
    externalHosts: new Set(externalRecent.map((e) => e.host_id)).size,
    externalEvents: externalRecent.length,
    founderSharePct: hostedRecent.length
      ? Math.round(((hostedRecent.length - externalRecent.length) / hostedRecent.length) * 100)
      : 0,
    mau: actual.mau,
    activationPct: users.length ? Math.round((everRequested.size / users.length) * 100) : 0,
    repeatPct: everRequested.size ? Math.round((repeaters / everRequested.size) * 100) : 0,
    revenue: actual.revenue,
    proSubscribers: actual.proSubscribers,
  };

  const op = currentOperating();

  // Counted here rather than fetched again: users and rsvps are already in
  // memory for the metrics above, so these are three passes over arrays
  // rather than three more round trips.
  const members = users.filter((u) => !u.is_admin && !u.is_team);
  const memberCount = members.length;

  /**
   * Signups today, this week and this month.
   *
   * Month alone was not enough: on the 28th it is a nearly complete figure
   * and on the 2nd it is noise, and either way it cannot tell you whether
   * today was good. Three windows turn one number into a trend you can read
   * at a glance, which is the only reason to put a number on a wall.
   *
   * Today is midnight in LAGOS, not UTC. The two disagree for the first hour
   * of every day, which is exactly when somebody checking last night's
   * numbers would be looking.
   */
  const lagosToday = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  });
  const dayStart = `${lagosToday}T00:00:00`;
  const weekStart = new Date(Date.now() - 7 * DAY).toISOString();
  const monthStart = `${lagosToday.slice(0, 7)}-01`;

  const newToday = members.filter((u) => u.created_at >= dayStart).length;
  const newThisWeek = members.filter((u) => u.created_at >= weekStart).length;
  const newThisMonth = members.filter((u) => u.created_at >= monthStart).length;
  const dormantCount = members.filter((u) => !everRequested.has(u.id)).length;

  /* -------------------------------------------------------------- today ---- */
  /**
   * What to do before the end of the day, worked out rather than written down.
   *
   * A static checklist goes stale in a week and gets ignored in two. Every
   * line here is a live count with a number attached, so it empties when the
   * work is done and reappears when it is needed. If a row says zero it is
   * not shown at all, because a list of things that are already fine is
   * another thing not to read.
   *
   * Each one is chosen because it moves a target on this page, not because it
   * is generally good practice.
   */
  const dayAgo = new Date(Date.now() - DAY).toISOString();
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const weekOut = new Date(Date.now() + 7 * DAY).toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  });

  /**
   * Somebody asked to come, nobody answered, and the night has not happened
   * yet. Kills activation and repeat rate at once.
   *
   * THE FIRST VERSION OF THIS COUNTED TEN AND MEANT TWO. It took every
   * pending row older than a day, which swept up two things that are not
   * somebody waiting:
   *
   *   Eight were for events that had already happened, the oldest a picnic
   *   in June. Nobody is waiting on a night that is three months gone; that
   *   is a stale row, not a job.
   *
   *   Six were the platform's own account requesting to join events. Chasing
   *   a host on our own behalf is not the work.
   *
   * Both filters are on now, and the number it reports is two: one member,
   * twice, on one host's upcoming events. That is a thing you can actually
   * do something about this afternoon, which the ten never was.
   */
  const eventDate = new Map(events.map((e) => [e.id, e.date]));
  const stalePending = rsvps.filter(
    (r) =>
      r.status === "pending" &&
      r.created_at < dayAgo &&
      !staff.has(r.user_id) &&
      (eventDate.get(r.event_id) ?? "") >= todayIso
  ).length;

  // Signed up this week and never asked to join anything. This is the
  // activation target, one person at a time.
  const neverRequested = users.filter(
    (u) => !u.is_admin && u.created_at >= weekAgo && !everRequested.has(u.id)
  ).length;

  // Hosted before, gone quiet. Cheaper to wake a host than find one, and
  // "hosts who are not you" is the target everything else hangs off.
  const lastHosted = new Map<string, string>();
  for (const e of hosted) {
    const prev = lastHosted.get(e.host_id);
    if (!prev || e.created_at > prev) lastHosted.set(e.host_id, e.created_at);
  }
  const dormantHosts = Array.from(lastHosted.entries()).filter(
    ([id, when]) => !staff.has(id) && when < since
  ).length;

  /**
   * On this week, nearly empty, and somebody else's.
   *
   * STAFF EVENTS ARE EXCLUDED, and finding out why was the point of writing
   * this. Fourteen events this week have fewer than three people and twelve
   * of them are ours. Worse: all 47 events the founder's account created this
   * month have ZERO accepted guests, every single one. They are imported
   * listings in all but the is_listing flag.
   *
   * So counting them here would bury the two that matter under twelve that
   * cannot be rescued by a nudge, and the reason this row exists is that a
   * host whose first night is empty does not host a second one. That only
   * applies to a real host.
   */
  const acceptedPer = new Map<string, number>();
  for (const r of rsvps) {
    if (r.status === "accepted") acceptedPer.set(r.event_id, (acceptedPer.get(r.event_id) ?? 0) + 1);
  }
  const thinThisWeek = events.filter(
    (e) =>
      !e.is_listing &&
      !staff.has(e.host_id) &&
      e.date >= todayIso &&
      e.date <= weekOut &&
      (acceptedPer.get(e.id) ?? 0) < 3
  ).length;

  const daysToOp = op
    ? Math.max(1, Math.ceil((new Date(`${op.due}T23:59:59`).getTime() - Date.now()) / DAY))
    : 0;
  const hostGap = op ? Math.max(0, op.externalHosts - opActual.externalHosts) : 0;
  const eventGap = op ? Math.max(0, op.externalEvents - opActual.externalEvents) : 0;

  /**
   * Interest that never became a request, on events still ahead of us.
   *
   * The most useful row here, once there is anything in it. Somebody said
   * they wanted to go and then did not ask, which is a different failure from
   * never looking: the event is fine and the asking is what stopped them.
   * Every one is a message away from being a guest.
   *
   * Its own query, and a failure is treated as zero rather than as an error,
   * because event_interest arrives with a migration that may not have run.
   */
  const interestRes = await supabase
    .from("event_interest")
    .select("event_id, user_id");
  const interestRows = (interestRes.data ?? []) as {
    event_id: string;
    user_id: string;
  }[];
  const requestedPair = new Set(rsvps.map((r) => `${r.event_id}:${r.user_id}`));
  const warmLeads = interestRows.filter(
    (i) =>
      !requestedPair.has(`${i.event_id}:${i.user_id}`) &&
      (eventDate.get(i.event_id) ?? "") >= todayIso
  ).length;

  const todo = [
    {
      n: warmLeads,
      label: "said they were interested and never asked to join",
      why: "The event is fine and the asking is what stopped them. Closest thing you have to a warm lead.",
      href: isAdmin ? "/admin" : "/events",
    },
    {
      n: stalePending,
      label: "requests waiting more than a day",
      why: "Chase the host. An unanswered request is somebody deciding this place does not work.",
      href: isAdmin ? "/admin" : "/events",
    },
    {
      n: neverRequested,
      label: "joined this week and have not asked to join anything",
      why: "Message them something specific that is on soon. This is the activation target.",
      href: isAdmin ? "/admin" : "/events",
    },
    {
      n: dormantHosts,
      label: "hosts have not posted in 30 days",
      why: "Waking one is cheaper than finding one, and counts the same.",
      href: isAdmin ? "/admin" : "/events",
    },
    {
      n: thinThisWeek,
      label: "of other people's events this week have fewer than 3 going",
      why: "Push them. A host whose first night is empty does not host a second.",
      href: "/events",
    },
  ].filter((t) => t.n > 0);

  const target = currentMilestone();
  const passed = previousMilestone();
  const daysLeft = Math.ceil(
    (new Date(`${target.due}T23:59:59`).getTime() - Date.now()) / DAY
  );

  const measurable = METRICS.filter((m) => m.measurable);
  const hits = measurable.filter(
    (m) => verdict(actual[m.key], target[m.key] as number) === "hit"
  ).length;

  return (
    <div className="pb-24">
      <AppHeader title="Growth plan" back />

      <div className="mx-auto max-w-3xl px-4">
        {/* ------------------------------------------------ where we stand -- */}
        <div className="mt-4 rounded-3xl bg-gray-900 p-6 text-white">
          <p className="text-[13px] font-black uppercase tracking-[0.12em] text-white/50">
            Next milestone
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[32px] font-extrabold leading-none">{target.label}</h2>
            <p className="text-[15px] font-semibold text-white/70">
              due {new Date(`${target.due}T12:00:00`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <p className="mt-3 text-[15px] leading-snug text-white/75">
            {hits} of {measurable.length} measurable targets met.{" "}
            {daysLeft > 0
              ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left.`
              : "The date has passed."}
          </p>

          {/* -------------------------------------------- the whole house -- */}
          {/* Total members, new this month, and how many of them have ever
              asked to join anything. The page is otherwise all rates and
              targets, and a rate with no denominator on the screen is easy to
              read as bigger than it is: 22% activation sounds healthy until
              you see it is 22% of a couple of hundred people.

              The third figure is the one that matters and the one nothing
              else here shows. Everybody who signed up and never took the
              first step is the cheapest growth available, and the number only
              becomes a task once somebody can see it. */}
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-4">
            {/* "New" for signups and "never asked to join" for the dormant
                pile, because the old pair said "joined this month" beside
                "never joined anything" and meant two different things by the
                same word. */}
            {[
              ["Members", memberCount.toLocaleString(), null],
              ["New today", `+${newToday.toLocaleString()}`, null],
              ["New this week", `+${newThisWeek.toLocaleString()}`, null],
              ["New this month", `+${newThisMonth.toLocaleString()}`, null],
              [
                "Never asked to join",
                dormantCount.toLocaleString(),
                memberCount
                  ? `${Math.round((dormantCount / memberCount) * 100)}% of everyone`
                  : null,
              ],
            ].map(([label, value, note]) => (
              <div key={label as string} className="flex flex-col">
                <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-white/45">
                  {label}
                </span>
                <span className="mt-0.5 text-[26px] font-extrabold leading-none tabular-nums">
                  {value}
                </span>
                {note && (
                  <span className="mt-1 text-[12px] text-white/50">{note}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* --------------------------------------------------------- today -- */}
        {op && (
          <>
            <h2 className="mb-1 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
              Today
            </h2>
            <p className="mb-3 text-[13px] leading-snug text-gray-500">
              The arithmetic of {op.label}, divided by the {daysToOp}{" "}
              {daysToOp === 1 ? "day" : "days"} left.
            </p>

            <div className="rounded-3xl border-2 border-brand/25 bg-brand/[0.04] p-5">
              <p className="text-[17px] font-extrabold leading-snug text-gray-900 dark:text-white">
                {hostGap === 0 && eventGap === 0
                  ? "Both host targets are met. Hold them."
                  : hostGap > 0
                    ? `Find ${hostGap} more ${hostGap === 1 ? "host" : "hosts"} in ${daysToOp} days.`
                    : `Get ${eventGap} more ${eventGap === 1 ? "event" : "events"} out of the hosts you have.`}
              </p>
              {hostGap > 0 && (
                <p className="mt-1 text-[15px] leading-snug text-gray-600 dark:text-white/70">
                  One every {Math.max(1, Math.floor(daysToOp / hostGap))} days.
                  {eventGap > 0 && ` And ${eventGap} more events between them.`}
                </p>
              )}

              {todo.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {todo.map((t) => (
                    <Link
                      key={t.label}
                      href={t.href}
                      className="flex items-start gap-3 rounded-2xl bg-white p-3.5 transition hover:shadow-sm dark:bg-white/5"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-[15px] font-extrabold tabular-nums text-brand">
                        {t.n}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold leading-snug text-gray-900 dark:text-white">
                          {t.label}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-gray-600 dark:text-white/65">
                          {t.why}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-white p-3.5 text-[14px] text-gray-600 dark:bg-white/5 dark:text-white/70">
                  Nothing is waiting on you. Go and find a host.
                </p>
              )}
            </div>
          </>
        )}

        {/* -------------------------------------------- the operating plan -- */}
        {op && (
          <>
            <h2 className="mb-1 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
              This quarter · {op.label}
            </h2>
            <p className="mb-3 text-[13px] leading-snug text-gray-500">
              What the next 90 days can move, measured against the 30 days to
              27 Sep. Staff accounts ({staff.size}) are excluded from the host
              numbers.
            </p>

            <div className="space-y-3">
              {OPERATING_METRICS.map((m) => {
                const t = op[m.key] as number;
                const a = opActual[m.key];
                const base = OPERATING_BASELINE[m.key] as number;
                const v = m.ceiling ? verdictAtMost(a, t) : verdict(a, t);
                const style = VERDICT_STYLE[v];
                const ratio = m.ceiling
                  ? Math.min(100, t > 0 ? Math.round((t / Math.max(a, 1)) * 100) : 0)
                  : t > 0
                    ? Math.min(100, Math.round((a / t) * 100))
                    : 100;
                const show = (n: number) =>
                  m.naira ? naira(n) : `${n.toLocaleString()}${m.suffix ?? ""}`;

                return (
                  <div
                    key={m.key}
                    className="rounded-2xl border border-gray-200 p-4 dark:border-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-gray-900 dark:text-white">
                          {m.name}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-snug text-gray-500">
                          {m.note}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${style.chip}`}
                      >
                        {style.word}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-[26px] font-extrabold tabular-nums text-gray-900 dark:text-white">
                        {show(a)}
                      </span>
                      <span className="text-[15px] font-semibold text-gray-400">
                        {m.ceiling ? "against a cap of" : "of"} {show(t)}
                      </span>
                      <span className="ml-auto text-[13px] font-semibold text-gray-400">
                        {m.key === "proSubscribers" && compedPro > 0
                          ? `+${compedPro} comped`
                          : `was ${show(base)}`}
                      </span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div
                        className={`h-full rounded-full ${style.bar}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left dark:border-white/10">
                    <th className="px-3 py-2.5 font-bold text-gray-500">Metric</th>
                    <th className="px-3 py-2.5 text-right font-bold text-gray-500">Sep</th>
                    {OPERATING_PLAN.map((m) => (
                      <th
                        key={m.label}
                        className={`px-3 py-2.5 text-right font-bold ${m.label === op.label ? "text-brand" : "text-gray-500"}`}
                      >
                        {m.label.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OPERATING_METRICS.map((row) => {
                    const show = (n: number) =>
                      row.naira ? naira(n) : `${n.toLocaleString()}${row.suffix ?? ""}`;
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-gray-100 last:border-0 dark:border-white/5"
                      >
                        <td className="px-3 py-2.5 font-semibold text-gray-700 dark:text-white/80">
                          {row.name}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">
                          {show(OPERATING_BASELINE[row.key] as number)}
                        </td>
                        {OPERATING_PLAN.map((m) => (
                          <td
                            key={m.label}
                            className={`px-3 py-2.5 text-right tabular-nums ${m.label === op.label ? "font-bold text-gray-900 dark:text-white" : "text-gray-500"}`}
                          >
                            {show(m[row.key] as number)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ------------------------------------------------- the scorecard -- */}
        <h2 className="mb-1 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
          The ambition · against {target.label}
        </h2>
        <p className="mb-3 text-[13px] leading-snug text-gray-500">
          The 3-year plan, unchanged.
        </p>

        <div className="space-y-3">
          {METRICS.map((m) => {
            const t = target[m.key] as number;
            const a = actual[m.key];
            const v = verdict(a, t);
            const style = VERDICT_STYLE[v];
            const ratio = t > 0 ? Math.min(100, Math.round((a / t) * 100)) : 100;

            return (
              <div
                key={m.key}
                className="rounded-2xl border border-gray-200 p-4 dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-gray-900 dark:text-white">
                      {m.name}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-gray-500">
                      {m.note}
                    </p>
                  </div>
                  {m.measurable ? (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${style.chip}`}
                    >
                      {style.word}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-bold text-gray-500">
                      By hand
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[26px] font-extrabold tabular-nums text-gray-900 dark:text-white">
                    {m.measurable ? fmt(a, m.naira) : "—"}
                  </span>
                  <span className="text-[15px] font-semibold text-gray-400">
                    of {fmt(t, m.naira)}
                  </span>
                  {m.measurable && t > 0 && (
                    <span className="ml-auto text-[15px] font-bold tabular-nums text-gray-500">
                      {Math.round((a / t) * 100)}%
                    </span>
                  )}
                </div>

                {m.measurable && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full ${style.bar}`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ------------------------------------------- the one they missed -- */}
        <h2 className="mb-2 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
          Not in the plan
        </h2>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-amber-600">
              <LineIcon name="activity" size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-gray-900">
                Top 3 hosts made {concentration}% of the last 30 days of events
              </p>
              <p className="mt-1 text-[13px] leading-snug text-gray-700">
                The plan counts events and hosts separately and never asks how
                many people the events come from. Every target above depends on
                this number falling: if three people stop, the supply stops with
                them, and no amount of demand fixes it.
              </p>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------- what passed -- */}
        {passed && (
          <>
            <h2 className="mb-2 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
              {passed.label} has been and gone
            </h2>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
              <p className="text-[13px] leading-snug text-gray-500">
                Due {new Date(`${passed.due}T12:00:00`).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}. Measured now, not then, so this is where you ended up
                rather than where you were on the day.
              </p>
              <div className="mt-3 space-y-1.5">
                {measurable.map((m) => {
                  const t = passed[m.key] as number;
                  const a = actual[m.key];
                  const v = verdict(a, t);
                  return (
                    <div key={m.key} className="flex items-center justify-between gap-3 text-[14px]">
                      <span className="truncate text-gray-600 dark:text-white/70">{m.name}</span>
                      <span className="shrink-0 font-bold tabular-nums text-gray-900 dark:text-white">
                        {fmt(a, m.naira)}{" "}
                        <span className="font-semibold text-gray-400">
                          / {fmt(t, m.naira)}
                        </span>{" "}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${VERDICT_STYLE[v].chip}`}>
                          {VERDICT_STYLE[v].word}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ------------------------------------------------- the whole arc -- */}
        <h2 className="mb-2 mt-8 text-[13px] font-black uppercase tracking-[0.12em] text-gray-400">
          Every milestone
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 text-left dark:border-white/10">
                <th className="px-3 py-2.5 font-bold text-gray-500">Metric</th>
                {MILESTONES.map((m) => (
                  <th
                    key={m.label}
                    className={`px-3 py-2.5 text-right font-bold ${m.label === target.label ? "text-brand" : "text-gray-500"}`}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((row) => (
                <tr key={row.key} className="border-b border-gray-100 last:border-0 dark:border-white/5">
                  <td className="px-3 py-2.5 font-semibold text-gray-700 dark:text-white/80">
                    {row.name}
                  </td>
                  {MILESTONES.map((m) => (
                    <td
                      key={m.label}
                      className={`px-3 py-2.5 text-right tabular-nums ${m.label === target.label ? "font-bold text-gray-900 dark:text-white" : "text-gray-500"}`}
                    >
                      {fmt(m[row.key] as number, row.naira)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[13px] leading-snug text-gray-500">
          Targets live in{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[12px] dark:bg-white/10">
            lib/growth-plan.ts
          </code>
          . Changing one is a commit, so a moved goalpost leaves a trace.
        </p>

        {/* Analytics is is_admin only, so a teammate would land on a 404. */}
        {isAdmin && (
        <Link
          href="/admin/analytics"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5 text-[14px] font-bold text-gray-700 transition hover:bg-gray-200"
        >
          <LineIcon name="trending" size={16} />
          Full analytics
        </Link>
        )}
      </div>
    </div>
  );
}

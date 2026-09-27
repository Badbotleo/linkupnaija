/**
 * The 3-year plan, as numbers a machine can check.
 *
 * Taken from the Key Metrics Tracker on the last page of
 * LinkUpNaija_3Year_Growth_Plan_v2.pdf. The PDF is the argument and the prose;
 * this file is only the targets, so that /admin/growth can say which ones are
 * met without anybody reading fourteen pages and doing arithmetic.
 *
 * WHY TARGETS LIVE IN CODE. They are a decision, not data. Putting them in a
 * table would let them be edited quietly, and a target that moves without a
 * trace is not a target. Changing one here is a commit with a diff and a
 * reason, which is the point.
 *
 * DATES. The plan runs from 1 July 2026 ("Months 1-3 · July - September
 * 2026"), so each milestone is dated to the end of its window. The page
 * compares against the NEXT milestone that has not yet passed, which is the
 * only one you can still do anything about.
 *
 * Revenue is gross, in naira, counting both ticket transactions and Premium
 * payments in the milestone's month. The plan says "Monthly Revenue" without
 * defining it; this is the most favourable honest reading.
 */

export interface Milestone {
  /** As the PDF labels the column. */
  label: string;
  /** Last day of this milestone's window, ISO. */
  due: string;
  /** People who requested a spot in the trailing 30 days. */
  mau: number;
  /** Gross naira in the trailing 30 days, tickets plus Premium. */
  revenue: number;
  /** Events created by a host in the trailing 30 days. Listings do not count. */
  eventsPerMonth: number;
  /** Distinct people who created one of those events. */
  activeHosts: number;
  /** Members holding an unexpired Pro subscription. */
  proSubscribers: number;
  /** Not in the database. Entered by hand, or left alone. */
  instagramFollowers: number;
  /** Distinct Nigerian states carrying at least one event. */
  cities: number;
}

export const PLAN_START = "2026-07-01";

export const MILESTONES: Milestone[] = [
  {
    label: "Month 1",
    due: "2026-07-31",
    mau: 50,
    revenue: 50_000,
    eventsPerMonth: 10,
    activeHosts: 5,
    proSubscribers: 0,
    instagramFollowers: 100,
    cities: 1,
  },
  {
    label: "Month 3",
    due: "2026-09-30",
    mau: 500,
    revenue: 500_000,
    eventsPerMonth: 50,
    activeHosts: 20,
    proSubscribers: 10,
    instagramFollowers: 500,
    cities: 2,
  },
  {
    label: "Month 6",
    due: "2026-12-31",
    mau: 2_000,
    revenue: 2_000_000,
    eventsPerMonth: 200,
    activeHosts: 100,
    proSubscribers: 50,
    instagramFollowers: 3_000,
    cities: 3,
  },
  {
    label: "Year 1",
    due: "2027-06-30",
    mau: 5_000,
    revenue: 5_000_000,
    eventsPerMonth: 500,
    activeHosts: 300,
    proSubscribers: 200,
    instagramFollowers: 15_000,
    cities: 10,
  },
  {
    label: "Year 2",
    due: "2028-06-30",
    mau: 50_000,
    revenue: 30_000_000,
    eventsPerMonth: 5_000,
    activeHosts: 3_000,
    proSubscribers: 2_000,
    instagramFollowers: 100_000,
    cities: 36,
  },
  {
    label: "Year 3",
    due: "2029-06-30",
    mau: 500_000,
    revenue: 150_000_000,
    eventsPerMonth: 25_000,
    activeHosts: 15_000,
    proSubscribers: 15_000,
    instagramFollowers: 500_000,
    cities: 36,
  },
];

/**
 * The milestone still ahead of you, or the last one once the plan is over.
 * Judged in Lagos time, because a plan written in Abuja should not roll over
 * an hour early.
 */
export function currentMilestone(now = new Date()): Milestone {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  return MILESTONES.find((m) => m.due >= today) ?? MILESTONES[MILESTONES.length - 1];
}

/** The one before it, so the page can show what was and was not met. */
export function previousMilestone(now = new Date()): Milestone | null {
  const current = currentMilestone(now);
  const i = MILESTONES.indexOf(current);
  return i > 0 ? MILESTONES[i - 1] : null;
}

/* ------------------------------------------------------------------------ */
/*  The operating plan                                                       */
/* ------------------------------------------------------------------------ */

/**
 * What the next 90 days can actually move.
 *
 * The milestones above are the ambition and stay exactly as written. This is
 * the quarter in front of you, and it exists because the plan above cannot
 * see the thing that is actually wrong.
 *
 * WHAT THE MEASUREMENT FOUND. September was the best month this platform has
 * had for demand and the worst it has had for supply:
 *
 *   month   signups   active   events by hosts who are not staff   those hosts
 *   Jun        18        2                 5                            4
 *   Jul        24        4                12                            3
 *   Aug        52       16                 7                            5
 *   Sep       100       24                 4                            3
 *
 * Signups quintupled across the quarter while events from real hosts fell by
 * two thirds. The founder's own account made 47 of September's 51 events, so
 * the plan's "events created" target reads 104% while genuine supply is
 * collapsing underneath it. A target you can hit by working harder yourself
 * is not measuring the constraint.
 *
 * STAFF, NOT A HARDCODED ID. External means created by somebody who is not an
 * admin. Defining it that way rather than pasting a UUID means it keeps
 * working if the founder changes account, and it counts every staff account
 * rather than one. The page prints how many accounts it excluded so the
 * number can be checked at a glance.
 *
 * founderSharePct IS A CEILING, not a floor. It is the only target here that
 * your own effort pushes the wrong way, which given the constraint is exactly
 * what it should do. You can hit an events target by bulk-creating. You
 * cannot hit a falling share target that way.
 */
export interface OperatingTarget {
  label: string;
  due: string;
  /** Distinct non-staff accounts that created an event in the window. */
  externalHosts: number;
  /** Events those accounts created in the window. */
  externalEvents: number;
  /** Ceiling. Share of the window's events created by staff. */
  founderSharePct: number;
  mau: number;
  /** All-time: members who have ever requested a spot. Hold, not grow. */
  activationPct: number;
  /** All-time: of those, the share who requested more than once. */
  repeatPct: number;
  revenue: number;
  proSubscribers: number;
}

/**
 * Measured over the 30 days to 27 Sep 2026, the day this was written.
 *
 * proSubscribers is ONE, not eight. Eight accounts carry is_pro, and seven of
 * them were granted by hand. Counting a comped subscription as a subscriber
 * is how a revenue metric flatters itself: the number goes up and no money
 * moves. A hand-granted row has no paystack_reference, which is what makes
 * the distinction measurable rather than a matter of memory.
 */
export const OPERATING_BASELINE: Omit<OperatingTarget, "label" | "due"> = {
  externalHosts: 3,
  externalEvents: 4,
  founderSharePct: 92,
  mau: 24,
  activationPct: 20,
  repeatPct: 32,
  revenue: 24_000,
  proSubscribers: 1,
};

export const OPERATING_PLAN: OperatingTarget[] = [
  {
    label: "October",
    due: "2026-10-31",
    externalHosts: 6,
    externalEvents: 10,
    founderSharePct: 70,
    mau: 45,
    activationPct: 20,
    repeatPct: 32,
    revenue: 75_000,
    proSubscribers: 3,
  },
  {
    label: "November",
    due: "2026-11-30",
    externalHosts: 10,
    externalEvents: 18,
    founderSharePct: 50,
    mau: 70,
    activationPct: 22,
    repeatPct: 35,
    revenue: 150_000,
    proSubscribers: 6,
  },
  {
    label: "December",
    due: "2026-12-31",
    externalHosts: 15,
    externalEvents: 30,
    founderSharePct: 35,
    mau: 110,
    activationPct: 25,
    repeatPct: 35,
    revenue: 300_000,
    proSubscribers: 10,
  },
];

export function currentOperating(now = new Date()): OperatingTarget | null {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  return OPERATING_PLAN.find((m) => m.due >= today) ?? null;
}

export interface OperatingRow {
  key: keyof Omit<OperatingTarget, "label" | "due">;
  name: string;
  note: string;
  /** True when a LOWER number is better, so the verdict flips. */
  ceiling?: boolean;
  naira?: boolean;
  suffix?: string;
}

export const OPERATING_METRICS: OperatingRow[] = [
  {
    key: "externalHosts",
    name: "Hosts who are not you",
    note: "Non-staff accounts that created an event in the last 30 days. Everything else is downstream of this.",
  },
  {
    key: "externalEvents",
    name: "Events they created",
    note: "Supply you did not have to make yourself.",
  },
  {
    key: "founderSharePct",
    name: "Your share of events",
    note: "A ceiling, not a floor. The one target your own work pushes the wrong way, which is the point.",
    ceiling: true,
    suffix: "%",
  },
  {
    key: "mau",
    name: "Monthly active users",
    note: "Requested a spot in the last 30 days.",
  },
  {
    key: "activationPct",
    name: "Activation",
    note: "Members who ever requested a spot. Hold this while paid acquisition scales, or you are buying people who never use it.",
    suffix: "%",
  },
  {
    key: "repeatPct",
    name: "Repeat rate",
    note: "Of those who requested once, the share who came back.",
    suffix: "%",
  },
  {
    key: "revenue",
    name: "Monthly revenue",
    note: "Deliberately small. Seven paid transactions in the platform's life so far.",
    naira: true,
  },
  {
    key: "proSubscribers",
    name: "Paying Pro subscribers",
    note: "People who paid, not people who were given it. Seven of the eight Pro accounts were comped.",
  },
];

export type Verdict = "hit" | "close" | "behind";

/** Close is 80%, which is the line between a miss and a rounding error. */
export function verdict(actual: number, target: number): Verdict {
  if (target <= 0) return actual >= 0 ? "hit" : "behind";
  const ratio = actual / target;
  if (ratio >= 1) return "hit";
  if (ratio >= 0.8) return "close";
  return "behind";
}

/**
 * For a ceiling, where smaller is the win.
 *
 * Feeding "your share of events" to verdict() above would call 92% against a
 * 70% cap a runaway success, which is the exact opposite of what it means.
 */
export function verdictAtMost(actual: number, ceiling: number): Verdict {
  if (actual <= ceiling) return "hit";
  if (ceiling > 0 && actual <= ceiling * 1.25) return "close";
  return "behind";
}

export interface MetricRow {
  key: keyof Omit<Milestone, "label" | "due">;
  name: string;
  /** Why this number matters, said once, so the page is not just digits. */
  note: string;
  /** False for anything the database cannot answer. */
  measurable: boolean;
  naira?: boolean;
}

export const METRICS: MetricRow[] = [
  {
    key: "mau",
    name: "Monthly active users",
    note: "Asked to join something in the last 30 days. Signing up is not activity.",
    measurable: true,
  },
  {
    key: "revenue",
    name: "Monthly revenue",
    note: "Gross naira in the last 30 days, tickets and Premium together.",
    measurable: true,
    naira: true,
  },
  {
    key: "eventsPerMonth",
    name: "Events created",
    note: "Created by a host in the last 30 days. Admin listings are not supply.",
    measurable: true,
  },
  {
    key: "activeHosts",
    name: "Active hosts",
    note: "Distinct people who created one of those events. The real constraint.",
    measurable: true,
  },
  {
    key: "proSubscribers",
    name: "Paying Pro subscribers",
    note: "Someone who actually paid. A hand-granted subscription has no Paystack reference, so it is not counted here.",
    measurable: true,
  },
  {
    key: "cities",
    name: "States with events",
    note: "Distinct states carrying at least one event, ever.",
    measurable: true,
  },
  {
    key: "instagramFollowers",
    name: "Instagram followers",
    note: "Not in the database. Check the account and judge this one yourself.",
    measurable: false,
  },
];

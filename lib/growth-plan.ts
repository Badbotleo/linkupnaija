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

export type Verdict = "hit" | "close" | "behind";

/** Close is 80%, which is the line between a miss and a rounding error. */
export function verdict(actual: number, target: number): Verdict {
  if (target <= 0) return actual >= 0 ? "hit" : "behind";
  const ratio = actual / target;
  if (ratio >= 1) return "hit";
  if (ratio >= 0.8) return "close";
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
    name: "Pro subscribers",
    note: "Holding an unexpired subscription right now.",
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

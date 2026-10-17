import type { SeriesFrequency } from "./types";

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

/** Parsed as a local date: `new Date("2026-10-30")` is UTC and drifts a day. */
function parse(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** How many of this weekday have happened in the month by this date. 1-5. */
function weekdayIndexInMonth(d: Date): number {
  return Math.floor((d.getDate() - 1) / 7) + 1;
}

/** True when no later date in the month shares this weekday. */
export function isLastWeekdayOfMonth(dateStr: string): boolean {
  const d = parse(dateStr);
  const probe = new Date(d);
  probe.setDate(probe.getDate() + 7);
  return probe.getMonth() !== d.getMonth();
}

/**
 * The date of the nth given weekday in a month, or the last one.
 *
 * Returns null when a month has no fifth Friday, which the caller skips
 * rather than silently sliding into the next month: a series that says
 * "fifth Friday" and quietly lands on the first of the following one is
 * worse than a month with no date in it.
 */
function nthWeekdayOf(
  year: number,
  month: number,
  weekday: number,
  nth: number | "last"
): Date | null {
  if (nth === "last") {
    const d = new Date(year, month + 1, 0); // last day of the month
    d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7));
    return d;
  }
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const d = new Date(year, month, day);
  return d.getMonth() === month ? d : null;
}

/**
 * The options a host actually sees, written out from the date they picked.
 *
 * "Monthly" meant "the same day number next month", which cannot say "the
 * last Friday" at all and breaks on the 31st: a 31 January series went to 3
 * March, because month 1 plus one month is 31 February. A host who runs
 * something on the last Friday had no way to express it and no way to tell
 * that the option on screen did not mean what they wanted.
 *
 * So the choices are generated from the chosen date and spelled out. The
 * host reads "Monthly on the last Friday" rather than deducing it.
 */
export function frequencyOptionsFor(
  startDate: string
): { value: SeriesFrequency; label: string }[] {
  const d = parse(startDate);
  if (Number.isNaN(d.getTime())) return BASE_OPTIONS;

  const weekday = WEEKDAYS[d.getDay()];
  const nth = weekdayIndexInMonth(d);
  const last = isLastWeekdayOfMonth(startDate);

  const options: { value: SeriesFrequency; label: string }[] = [
    { value: "weekly", label: `Weekly on ${weekday}` },
    { value: "biweekly", label: `Every 2 weeks on ${weekday}` },
    { value: "monthly", label: `Monthly on the ${ordinalDay(d.getDate())}` },
  ];

  // Both are offered when the date is both, say the fourth AND last Friday,
  // because "fourth" and "last" diverge in a five-Friday month and only the
  // host knows which they mean.
  options.push({
    value: "monthly_nth",
    label: last
      ? `Monthly on the last ${weekday}`
      : `Monthly on the ${ORDINALS[nth - 1]} ${weekday}`,
  });

  return options;
}

const BASE_OPTIONS: { value: SeriesFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "monthly_nth", label: "Monthly on the same weekday" },
];

/** Kept for callers that have no date in hand. */
export const FREQUENCY_OPTIONS = BASE_OPTIONS;

function ordinalDay(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function frequencyLabel(f: SeriesFrequency): string {
  return BASE_OPTIONS.find((o) => o.value === f)?.label ?? f;
}

/** Describes a saved series in words, using its own start date. */
export function describeFrequency(
  f: SeriesFrequency,
  startDate?: string | null
): string {
  if (!startDate) return frequencyLabel(f);
  return (
    frequencyOptionsFor(startDate).find((o) => o.value === f)?.label ??
    frequencyLabel(f)
  );
}

/**
 * The next `count` dates starting at `startDate` (inclusive).
 *
 * Computed from the start rather than by advancing the previous result, so a
 * monthly series cannot drift. Stepping 31 January forward one month at a
 * time gave 3 March, then 3 April, and the series was permanently on the
 * wrong day after one short month.
 */
export function nextDates(
  startDate: string,
  frequency: SeriesFrequency,
  count: number
): string[] {
  const start = parse(startDate);
  if (Number.isNaN(start.getTime())) return [];
  const out: string[] = [];

  if (frequency === "weekly" || frequency === "biweekly") {
    const step = frequency === "weekly" ? 7 : 14;
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i * step);
      out.push(iso(d));
    }
    return out;
  }

  if (frequency === "monthly_nth") {
    const weekday = start.getDay();
    const nth: number | "last" = isLastWeekdayOfMonth(startDate)
      ? "last"
      : weekdayIndexInMonth(start);
    let m = 0;
    // Months with no fifth Friday are skipped, not slid into the next month,
    // so the guard also stops an unbounded loop.
    while (out.length < count && m < count * 3 + 12) {
      const d = nthWeekdayOf(
        start.getFullYear(),
        start.getMonth() + m,
        weekday,
        nth
      );
      if (d && iso(d) >= startDate) out.push(iso(d));
      m++;
    }
    return out;
  }

  // Plain monthly: the same day number, clamped to the end of a short month.
  // 31 January repeats on 28 February rather than spilling into March.
  const day = start.getDate();
  for (let i = 0; i < count; i++) {
    const probe = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const lastDay = new Date(
      probe.getFullYear(),
      probe.getMonth() + 1,
      0
    ).getDate();
    out.push(iso(new Date(probe.getFullYear(), probe.getMonth(), Math.min(day, lastDay))));
  }
  return out;
}

/** Advance one interval. Kept for callers that step a single date. */
export function advanceDate(dateStr: string, frequency: SeriesFrequency): string {
  return nextDates(dateStr, frequency, 2)[1] ?? dateStr;
}

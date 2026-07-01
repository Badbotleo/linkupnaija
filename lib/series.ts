import type { SeriesFrequency } from "./types";

export const FREQUENCY_OPTIONS: {
  value: SeriesFrequency;
  label: string;
}[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

export function frequencyLabel(f: SeriesFrequency): string {
  return FREQUENCY_OPTIONS.find((o) => o.value === f)?.label ?? f;
}

/** Advance a YYYY-MM-DD date by one interval of the given frequency. */
export function advanceDate(dateStr: string, frequency: SeriesFrequency): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** The next `count` dates starting at `startDate` (inclusive). */
export function nextDates(
  startDate: string,
  frequency: SeriesFrequency,
  count: number
): string[] {
  const out: string[] = [];
  let d = startDate;
  for (let i = 0; i < count; i++) {
    out.push(d);
    d = advanceDate(d, frequency);
  }
  return out;
}

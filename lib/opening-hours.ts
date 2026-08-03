/**
 * Just enough OSM `opening_hours` to answer "are they open right now?".
 *
 * The full spec covers public holidays, sunset offsets, week numbers and month
 * ranges — none of which our venues use. This handles the shapes that actually
 * appear: "Mo-Fr 09:00-22:00; Sa,Su 10:00-00:00", "24/7", and "Mo-Su 10:00-02:00"
 * where closing after midnight means the next day.
 *
 * Anything it can't parse returns null rather than guessing, so a venue with
 * odd hours shows the raw string instead of a confident wrong answer.
 *
 * Evaluated in Africa/Lagos, not the viewer's timezone — a Lagos club's hours
 * don't change because someone checks from London.
 */

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export interface OpenState {
  open: boolean;
  /** "22:00" — when it next closes (if open) or opens (if closed). */
  until: string | null;
}

/** Minutes since midnight in Lagos, plus the weekday index (0 = Sunday). */
function lagosNow(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday").slice(0, 2);
  const day = DAYS.findIndex((d) => d.toLowerCase() === wd.toLowerCase());
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return { day: day < 0 ? 0 : day, minutes: hour * 60 + minute };
}

function toMinutes(hhmm: string): number | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/** "Mo-Fr" / "Sa,Su" / "Mo" -> day indices. */
function parseDays(spec: string): number[] {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const range = part.trim().match(/^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/);
    if (range) {
      const a = DAYS.findIndex((d) => d.toLowerCase() === range[1].toLowerCase());
      const b = DAYS.findIndex((d) => d.toLowerCase() === range[2].toLowerCase());
      if (a < 0 || b < 0) return [];
      // Ranges wrap: "Fr-Mo" is Fri, Sat, Sun, Mon.
      for (let i = a; ; i = (i + 1) % 7) {
        out.add(i);
        if (i === b) break;
      }
    } else {
      const i = DAYS.findIndex((d) => d.toLowerCase() === part.trim().toLowerCase());
      if (i < 0) return [];
      out.add(i);
    }
  }
  return Array.from(out);
}

function fmt(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function isOpenNow(
  spec: string | null | undefined,
  now = new Date()
): OpenState | null {
  if (!spec) return null;
  const raw = spec.trim();
  if (!raw) return null;

  if (/^24\s*\/\s*7$/.test(raw)) return { open: true, until: null };

  const { day, minutes } = lagosNow(now);
  let parsedAnything = false;
  let nextOpen: number | null = null;

  for (const rule of raw.split(";")) {
    const m = rule
      .trim()
      .match(/^([A-Za-z]{2}(?:\s*[-,]\s*[A-Za-z]{2})*)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) continue;

    const days = parseDays(m[1]);
    const from = toMinutes(m[2]);
    const to = toMinutes(m[3]);
    if (!days.length || from == null || to == null) continue;
    parsedAnything = true;

    // Closing at or before opening means it runs past midnight.
    const overnight = to <= from;

    if (days.includes(day)) {
      if (!overnight && minutes >= from && minutes < to) {
        return { open: true, until: fmt(to) };
      }
      if (overnight && minutes >= from) {
        return { open: true, until: fmt(to) };
      }
      if (minutes < from && (nextOpen == null || from < nextOpen)) nextOpen = from;
    }

    // Still inside last night's session that started yesterday.
    const yesterday = (day + 6) % 7;
    if (overnight && days.includes(yesterday) && minutes < to) {
      return { open: true, until: fmt(to) };
    }
  }

  if (!parsedAnything) return null;
  return { open: false, until: nextOpen == null ? null : fmt(nextOpen) };
}

/** Short label for a card: "Open · till 22:00" / "Closed · opens 09:00". */
export function openLabel(spec: string | null | undefined, now = new Date()): string | null {
  const state = isOpenNow(spec, now);
  if (!state) return null;
  if (state.open) return state.until ? `Open · till ${state.until}` : "Open 24/7";
  return state.until ? `Closed · opens ${state.until}` : "Closed";
}

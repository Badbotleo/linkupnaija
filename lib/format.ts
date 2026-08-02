// Small formatting helpers shared across the app.

export function formatEventDate(date: string): string {
  // date is "YYYY-MM-DD"
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Compact relative timestamp for social feeds: "34s", "12m", "5h", "3d",
// then "12 Mar" once it's over a week old (and a year once it's not this year).
export function timeAgo(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const secs = Math.max(0, (Date.now() - then.getTime()) / 1000);

  if (secs < 60) return `${Math.floor(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d`;

  const sameYear = then.getFullYear() === new Date().getFullYear();
  return then.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatEventTime(time: string): string {
  // time is "HH:MM" or "HH:MM:SS"
  const [h, m] = time.split(":");
  const hour = Number(h);
  if (Number.isNaN(hour)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m ?? "00"} ${period}`;
}

/**
 * Venue prices are free text an admin typed, so the real rows look like
 * "5000-50000", " ₦20,000–80,000" and "Free Entry". Normalise every amount to
 * a proper naira figure without destroying the words around it.
 *
 * Returns null for empty input and passes non-numeric text ("Free Entry")
 * straight through, so we never stamp ₦ on something that isn't a price.
 */
export function formatPriceRange(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (!/\d/.test(text)) return text;

  return (
    text
      // Any amount, whether or not the admin bothered with the ₦ or commas.
      .replace(
        /₦?\s?(\d[\d,]*)/g,
        (_m, n: string) =>
          `₦${Number(n.replace(/,/g, "")).toLocaleString("en-NG")}`
      )
      // Hyphen / en dash / em dash between two amounts reads as a range.
      .replace(/\s*[–—-]\s*/g, " – ")
  );
}
